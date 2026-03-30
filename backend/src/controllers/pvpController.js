const { query } = require('../db');
const { simulateCombat } = require('../combat');
const { getIo } = require('../socket');

const WIN_TROPHIES  = 12;
const LOSE_TROPHIES = 10;
const TROPHY_FLOOR  = 10;
const RESULT_DELAY_MS = 5 * 60 * 1000; // 5 minutes

function getLeague(trophies) {
  if (trophies >= 200) return 'Elmas';
  if (trophies >= 100) return 'Platin';
  if (trophies >= 50)  return 'Altin';
  if (trophies >= 25)  return 'Gumus';
  return 'Bronz';
}

function calcTransfer(loserAmt, winnerAmt, winnerCap) {
  // No transfer if loser has 0 or exactly 1 of this resource
  if (loserAmt <= 1) return 0;
  let steal = Math.floor(loserAmt * 0.10);
  if (steal < 1) steal = 1;
  steal = Math.min(steal, 15);
  const winnerRemaining = winnerCap - winnerAmt;
  return Math.max(0, Math.min(steal, winnerRemaining));
}

// Shared matchmaking logic — finds an eligible opponent and their defender champion.
// Does NOT write to the database.
async function resolveOpponent(playerId, attTrophies, opponentId) {
  if (opponentId) {
    // Specific opponent requested (from findOpponent result)
    const row = await query('SELECT * FROM players WHERE id = $1', [opponentId]);
    if (row.length && row[0].defender_champion_id) return row[0];
  }

  // ±30 real players
  const real30 = await query(
    `SELECT * FROM players
     WHERE id != $1 AND is_bot = FALSE AND pvp_unlocked = TRUE
       AND defender_champion_id IS NOT NULL
       AND trophies BETWEEN $2 AND $3
       AND (defense_shield_until IS NULL OR defense_shield_until <= NOW())`,
    [playerId, attTrophies - 30, attTrophies + 30]
  );
  if (real30.length) return real30[Math.floor(Math.random() * real30.length)];

  // ±60
  const real60 = await query(
    `SELECT * FROM players
     WHERE id != $1 AND is_bot = FALSE AND pvp_unlocked = TRUE
       AND defender_champion_id IS NOT NULL
       AND trophies BETWEEN $2 AND $3
       AND (defense_shield_until IS NULL OR defense_shield_until <= NOW())`,
    [playerId, attTrophies - 60, attTrophies + 60]
  );
  if (real60.length) return real60[Math.floor(Math.random() * real60.length)];

  // Bot fallback
  const bots = await query(
    `SELECT * FROM players WHERE is_bot = TRUE AND defender_champion_id IS NOT NULL`
  );
  if (bots.length) return bots[Math.floor(Math.random() * bots.length)];

  return null;
}

// GET /api/pvp/find-opponent?champion_id=xxx
// Finds an opponent and returns their info. No DB writes — pure preview.
async function findOpponent(req, res) {
  const playerId = req.player.id;
  const { champion_id } = req.query;

  if (!champion_id) return res.status(400).json({ error: 'champion_id is required' });

  try {
    const champRows = await query(
      'SELECT * FROM champions WHERE id = $1 AND player_id = $2',
      [champion_id, playerId]
    );
    if (!champRows.length) return res.status(404).json({ error: 'Champion not found' });
    const attChamp = champRows[0];
    if (attChamp.current_hp <= 0) return res.status(400).json({ error: 'Champion is dead' });
    if (attChamp.level < 3)       return res.status(400).json({ error: 'Champion must be level 3 to enter PvP' });

    const attPlayerRow = await query('SELECT trophies FROM players WHERE id = $1', [playerId]);
    const attTrophies = attPlayerRow[0].trophies;

    const opponent = await resolveOpponent(playerId, attTrophies, null);
    if (!opponent) return res.status(400).json({ error: 'No opponents available right now' });

    const defChampRows = await query('SELECT * FROM champions WHERE id = $1', [opponent.defender_champion_id]);
    if (!defChampRows.length) return res.status(400).json({ error: 'Defender has no valid champion' });
    const defChamp = defChampRows[0];

    res.json({
      opponentId:            opponent.id,
      opponentName:          opponent.username,
      opponentChampionId:    defChamp.id,
      opponentChampionName:  defChamp.name,
      opponentChampionClass: defChamp.class,
      opponentStats: {
        attack:  defChamp.attack,
        defense: defChamp.defense,
        chance:  defChamp.chance,
        max_hp:  defChamp.max_hp,
      },
      opponentTrophies: opponent.trophies,
      opponentLeague:   getLeague(opponent.trophies),
    });
  } catch (err) {
    console.error('findOpponent error:', err);
    res.status(500).json({ error: 'Failed to find opponent' });
  }
}

// POST /api/pvp/attack
async function attackPvp(req, res) {
  const playerId = req.player.id;
  const { champion_id, opponent_id, revenge_battle_id } = req.body;

  if (!champion_id) return res.status(400).json({ error: 'champion_id is required' });

  try {
    // Validate attacker champion
    const champRows = await query(
      'SELECT * FROM champions WHERE id = $1 AND player_id = $2',
      [champion_id, playerId]
    );
    if (!champRows.length) return res.status(404).json({ error: 'Champion not found' });
    const attChamp = champRows[0];
    if (attChamp.is_deployed)     return res.status(400).json({ error: 'Champion is currently busy' });
    if (attChamp.current_hp <= 0) return res.status(400).json({ error: 'Champion is dead' });
    if (attChamp.level < 3)       return res.status(400).json({ error: 'Champion must be level 3 to enter PvP' });

    // No pending battle already
    const pending = await query(
      `SELECT id FROM pvp_battles WHERE attacker_id = $1 AND status = 'pending'`,
      [playerId]
    );
    if (pending.length) return res.status(400).json({ error: 'You already have a pending battle' });

    const attPlayerRow = await query('SELECT trophies, username FROM players WHERE id = $1', [playerId]);
    const attTrophies = attPlayerRow[0].trophies;

    // ── Find opponent ──────────────────────────────────────────────────────────
    let opponent = null;

    if (revenge_battle_id) {
      const origBattle = await query(
        `SELECT * FROM pvp_battles WHERE id = $1 AND defender_id = $2 AND revenge_used = FALSE`,
        [revenge_battle_id, playerId]
      );
      if (!origBattle.length) return res.status(400).json({ error: 'Revenge not available for this battle' });
      const targetRow = await query('SELECT * FROM players WHERE id = $1', [origBattle[0].attacker_id]);
      if (!targetRow.length || !targetRow[0].defender_champion_id) {
        return res.status(400).json({ error: 'Target is no longer available' });
      }
      opponent = targetRow[0];
      await query('UPDATE pvp_battles SET revenge_used = TRUE WHERE id = $1', [revenge_battle_id]);
    } else {
      opponent = await resolveOpponent(playerId, attTrophies, opponent_id || null);
      if (!opponent) return res.status(400).json({ error: 'No opponents available right now' });
    }

    // Get defender champion
    const defChampRows = await query('SELECT * FROM champions WHERE id = $1', [opponent.defender_champion_id]);
    if (!defChampRows.length) return res.status(400).json({ error: 'Defender has no valid champion' });
    const defChamp = defChampRows[0];

    // ── Simulate combat ────────────────────────────────────────────────────────
    const attacker = { attack: attChamp.attack, defense: attChamp.defense, chance: attChamp.chance, max_hp: attChamp.max_hp };
    const defender = { attack: defChamp.attack, defense: defChamp.defense, chance: defChamp.chance, max_hp: defChamp.max_hp };
    const result = simulateCombat(attacker, defender);

    const attackerWon = result.winner === 'attacker';
    const winnerId = attackerWon ? playerId : opponent.id;
    const loserId  = attackerWon ? opponent.id : playerId;

    const attDelta = attackerWon ? WIN_TROPHIES  : -LOSE_TROPHIES;
    const defDelta = attackerWon ? -LOSE_TROPHIES : WIN_TROPHIES;

    // ── Update trophies ────────────────────────────────────────────────────────
    await query('UPDATE players SET trophies = GREATEST($1, trophies + $2) WHERE id = $3', [TROPHY_FLOOR, attDelta, playerId]);
    await query('UPDATE players SET trophies = GREATEST($1, trophies + $2) WHERE id = $3', [TROPHY_FLOOR, defDelta, opponent.id]);

    // ── Resource transfer ──────────────────────────────────────────────────────
    const loserResRows  = await query('SELECT strawberry, pinecone, blueberry FROM player_resources WHERE player_id = $1', [loserId]);
    const winnerResRows = await query('SELECT strawberry, pinecone, blueberry, strawberry_cap, pinecone_cap, blueberry_cap FROM player_resources WHERE player_id = $1', [winnerId]);

    const transfers = { strawberry: 0, pinecone: 0, blueberry: 0 };
    if (loserResRows.length && winnerResRows.length) {
      const l = loserResRows[0];
      const w = winnerResRows[0];
      for (const r of ['strawberry', 'pinecone', 'blueberry']) {
        transfers[r] = calcTransfer(l[r] || 0, w[r] || 0, w[`${r}_cap`] || 10);
      }
      // Always deduct from loser — including bots (seeded resources decrease)
      await query(
        `UPDATE player_resources SET strawberry = GREATEST(0, strawberry - $1), pinecone = GREATEST(0, pinecone - $2), blueberry = GREATEST(0, blueberry - $3) WHERE player_id = $4`,
        [transfers.strawberry, transfers.pinecone, transfers.blueberry, loserId]
      );
      await query(
        `UPDATE player_resources SET
          strawberry = LEAST(strawberry + $1, strawberry_cap),
          pinecone   = LEAST(pinecone   + $2, pinecone_cap),
          blueberry  = LEAST(blueberry  + $3, blueberry_cap)
         WHERE player_id = $4`,
        [transfers.strawberry, transfers.pinecone, transfers.blueberry, winnerId]
      );
      // Refresh bot resources so they never run dry
      if (opponent.is_bot) {
        await query(
          `UPDATE player_resources SET
            strawberry = GREATEST(strawberry, 20),
            pinecone   = GREATEST(pinecone,   20),
            blueberry  = GREATEST(blueberry,  20)
           WHERE player_id = $1`,
          [opponent.id]
        );
      }
    }

    // ── Defender champion last_defender ────────────────────────────────────────
    await query('UPDATE champions SET last_defender = FALSE WHERE player_id = $1', [opponent.id]);
    await query('UPDATE champions SET last_defender = TRUE  WHERE id = $1', [defChamp.id]);

    // ── Defense shield ─────────────────────────────────────────────────────────
    if (!opponent.is_bot) {
      await query(`UPDATE players SET defense_shield_until = NOW() + INTERVAL '15 minutes' WHERE id = $1`, [opponent.id]);
    }

    // ── Mark attacker champion as deployed (busy in PvP) ──────────────────────
    await query('UPDATE champions SET is_deployed = TRUE WHERE id = $1', [champion_id]);

    // ── Save battle ────────────────────────────────────────────────────────────
    const resultAvailableAt = new Date(Date.now() + RESULT_DELAY_MS);

    const battleRows = await query(
      `INSERT INTO pvp_battles
         (attacker_id, defender_id, attacker_champion_id, defender_champion_id, winner_id,
          battle_log, combat_log, status, result_available_at,
          attacker_trophies_delta, defender_trophies_delta,
          transferred_strawberry, transferred_pinecone, transferred_blueberry)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [playerId, opponent.id, champion_id, defChamp.id, winnerId,
       JSON.stringify(result.log), JSON.stringify(result.log),
       resultAvailableAt, attDelta, defDelta,
       transfers.strawberry, transfers.pinecone, transfers.blueberry]
    );

    // ── WebSocket notification ─────────────────────────────────────────────────
    if (!opponent.is_bot) {
      const io = getIo();
      if (io) io.to(`player:${opponent.id}`).emit('pvp:attacked', { battleId: battleRows[0].id, attackerName: req.player.username });
    }

    res.json({
      battleId:              battleRows[0].id,
      resultAvailableAt:     resultAvailableAt.toISOString(),
      opponentName:          opponent.username,
      opponentChampionName:  defChamp.name,
      opponentChampionClass: defChamp.class,
    });
  } catch (err) {
    console.error('attackPvp error:', err);
    res.status(500).json({ error: 'Attack failed' });
  }
}

// GET /api/pvp/status
async function getPvpStatus(req, res) {
  const playerId = req.player.id;
  try {
    const playerRow = await query(
      'SELECT trophies, defender_champion_id FROM players WHERE id = $1',
      [playerId]
    );
    const { trophies, defender_champion_id } = playerRow[0];

    const lv3Rows = await query(
      'SELECT 1 FROM champions WHERE player_id = $1 AND level >= 3 LIMIT 1',
      [playerId]
    );
    const pvp_unlocked = lv3Rows.length > 0;
    // Keep the DB column in sync (best-effort — column may not exist yet if migration hasn't run)
    if (pvp_unlocked) {
      try {
        await query('UPDATE players SET pvp_unlocked = TRUE WHERE id = $1 AND pvp_unlocked = FALSE', [playerId]);
      } catch (_) { /* column not migrated yet — safe to ignore */ }
    }

    const pendingRows = await query(
      `SELECT b.id, b.result_available_at, b.attacker_champion_id, opp.username AS opponent_name
       FROM pvp_battles b
       JOIN players opp ON opp.id = b.defender_id
       WHERE b.attacker_id = $1 AND b.status = 'pending'
       ORDER BY b.fought_at DESC LIMIT 1`,
      [playerId]
    );

    res.json({
      trophies,
      league: getLeague(trophies),
      pvp_unlocked: !!pvp_unlocked,
      defender_champion_id: defender_champion_id || null,
      pending_battle: pendingRows.length ? {
        battleId:              pendingRows[0].id,
        result_available_at:   pendingRows[0].result_available_at,
        attacker_champion_id:  pendingRows[0].attacker_champion_id,
        opponent_name:         pendingRows[0].opponent_name,
      } : null,
    });
  } catch (err) {
    console.error('getPvpStatus error:', err);
    res.status(500).json({ error: 'Failed to get PvP status' });
  }
}

// GET /api/pvp/battles  — newly resolved battles
async function getBattles(req, res) {
  const playerId = req.player.id;
  try {
    const battles = await query(
      `SELECT b.*,
         att.username   AS attacker_name,
         def.username   AS defender_name,
         att_c.name     AS attacker_champion_name,
         att_c.class    AS attacker_champion_class,
         def_c.name     AS defender_champion_name,
         def_c.class    AS defender_champion_class
       FROM pvp_battles b
       JOIN players att   ON att.id   = b.attacker_id
       JOIN players def   ON def.id   = b.defender_id
       JOIN champions att_c ON att_c.id = b.attacker_champion_id
       JOIN champions def_c ON def_c.id = b.defender_champion_id
       WHERE (b.attacker_id = $1 OR b.defender_id = $1)
         AND b.status = 'pending'
         AND b.result_available_at <= NOW()
       ORDER BY b.fought_at DESC`,
      [playerId]
    );

    for (const b of battles) {
      await query(
        `UPDATE pvp_battles SET
           status = 'resolved',
           seen_by_attacker = CASE WHEN attacker_id = $1 THEN TRUE ELSE seen_by_attacker END,
           seen_by_defender = CASE WHEN defender_id = $1 THEN TRUE ELSE seen_by_defender END
         WHERE id = $2`,
        [playerId, b.id]
      );
      // Free attacker champion
      if (b.attacker_id === playerId) {
        await query('UPDATE champions SET is_deployed = FALSE WHERE id = $1', [b.attacker_champion_id]);
      }
    }

    res.json(battles);
  } catch (err) {
    console.error('getBattles error:', err);
    res.status(500).json({ error: 'Failed to get battles' });
  }
}

// GET /api/pvp/history
async function getHistory(req, res) {
  const playerId = req.player.id;
  try {
    const battles = await query(
      `SELECT b.*,
         att.username   AS attacker_name,
         def.username   AS defender_name,
         att_c.name     AS attacker_champion_name,
         att_c.class    AS attacker_champion_class,
         def_c.name     AS defender_champion_name,
         def_c.class    AS defender_champion_class
       FROM pvp_battles b
       JOIN players att   ON att.id   = b.attacker_id
       JOIN players def   ON def.id   = b.defender_id
       JOIN champions att_c ON att_c.id = b.attacker_champion_id
       JOIN champions def_c ON def_c.id = b.defender_champion_id
       WHERE (b.attacker_id = $1 OR b.defender_id = $1)
         AND b.status = 'resolved'
       ORDER BY b.fought_at DESC
       LIMIT 10`,
      [playerId]
    );
    res.json(battles);
  } catch (err) {
    console.error('getHistory error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
}

// POST /api/pvp/set-defender
async function setDefender(req, res) {
  const playerId = req.player.id;
  const { champion_id } = req.body;
  if (!champion_id) return res.status(400).json({ error: 'champion_id is required' });

  try {
    const lv3Check = await query(
      'SELECT 1 FROM champions WHERE player_id = $1 AND level >= 3 LIMIT 1',
      [playerId]
    );
    if (!lv3Check.length) return res.status(400).json({ error: 'PvP is locked. Level a champion to 3 first.' });

    const champRows = await query('SELECT * FROM champions WHERE id = $1 AND player_id = $2', [champion_id, playerId]);
    if (!champRows.length) return res.status(404).json({ error: 'Champion not found' });
    const champ = champRows[0];
    if (champ.last_defender)   return res.status(400).json({ error: 'This champion just defended. Choose another.' });
    if (champ.is_deployed)     return res.status(400).json({ error: 'A busy champion cannot be a defender' });
    if (champ.current_hp <= 0) return res.status(400).json({ error: 'A dead champion cannot be a defender' });

    await query('UPDATE players SET defender_champion_id = $1 WHERE id = $2', [champion_id, playerId]);
    const playerRow = await query('SELECT trophies, defender_champion_id FROM players WHERE id = $1', [playerId]);
    res.json({ success: true, defender_champion_id: champion_id, trophies: playerRow[0].trophies, league: getLeague(playerRow[0].trophies) });
  } catch (err) {
    console.error('setDefender error:', err);
    res.status(500).json({ error: 'Failed to set defender' });
  }
}

module.exports = { findOpponent, attackPvp, getPvpStatus, getBattles, getHistory, setDefender };
