const { query } = require('../db');
const { simulateCombat } = require('../combat');

async function listDungeons(req, res) {
  try {
    const dungeons = await query('SELECT * FROM dungeons ORDER BY duration_minutes ASC');
    res.json(dungeons);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dungeons' });
  }
}

async function enterDungeon(req, res) {
  const playerId = req.player.id;
  const dungeonId = req.params.id;
  const { champion_id } = req.body;

  if (!champion_id) {
    return res.status(400).json({ error: 'champion_id is required' });
  }

  try {
    // Validate champion belongs to player and is not deployed
    const champRows = await query(
      'SELECT * FROM champions WHERE id = $1 AND player_id = $2',
      [champion_id, playerId]
    );
    if (champRows.length === 0) {
      return res.status(404).json({ error: 'Champion not found' });
    }
    const champion = champRows[0];
    if (champion.is_deployed) {
      return res.status(400).json({ error: 'Champion is already deployed' });
    }

    // Validate dungeon exists
    const dungeonRows = await query('SELECT * FROM dungeons WHERE id = $1', [dungeonId]);
    if (dungeonRows.length === 0) {
      return res.status(404).json({ error: 'Dungeon not found' });
    }
    const dungeon = dungeonRows[0];

    // Check champion has no active run already
    const activeRun = await query(
      `SELECT id FROM dungeon_runs WHERE champion_id = $1 AND status = 'active'`,
      [champion_id]
    );
    if (activeRun.length > 0) {
      return res.status(400).json({ error: 'Champion already on a dungeon run' });
    }

    const durationMs = dungeon.duration_seconds
      ? dungeon.duration_seconds * 1000
      : dungeon.duration_minutes * 60 * 1000;
    const endsAt = new Date(Date.now() + durationMs);

    const runRows = await query(
      `INSERT INTO dungeon_runs (player_id, champion_id, dungeon_id, ends_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [playerId, champion_id, dungeonId, endsAt]
    );

    await query('UPDATE champions SET is_deployed = TRUE WHERE id = $1', [champion_id]);

    res.status(201).json(runRows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enter dungeon' });
  }
}

async function getActiveRuns(req, res) {
  const playerId = req.player.id;

  try {
    const runs = await query(
      `SELECT dr.*, c.name AS champion_name, c.attack, c.defense, c.chance, c.max_hp,
              d.name AS dungeon_name, d.enemy_name, d.enemy_attack, d.enemy_defense,
              d.enemy_chance, d.enemy_hp, d.reward_resource, d.reward_amount
       FROM dungeon_runs dr
       JOIN champions c ON c.id = dr.champion_id
       JOIN dungeons d ON d.id = dr.dungeon_id
       WHERE dr.player_id = $1 AND dr.status IN ('active', 'completed')
       ORDER BY dr.started_at DESC`,
      [playerId]
    );
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
}

async function claimRun(req, res) {
  const playerId = req.player.id;
  const { runId } = req.params;

  try {
    const runRows = await query(
      `SELECT dr.*, c.attack, c.defense, c.chance, c.max_hp, c.current_hp, c.level, c.xp, c.xp_to_next_level,
              c.boost_hp, c.boost_defense, c.boost_chance,
              d.enemy_attack, d.enemy_defense, d.enemy_chance, d.enemy_hp,
              d.reward_resource, d.reward_amount, d.xp_reward
       FROM dungeon_runs dr
       JOIN champions c ON c.id = dr.champion_id
       JOIN dungeons d ON d.id = dr.dungeon_id
       WHERE dr.id = $1 AND dr.player_id = $2`,
      [runId, playerId]
    );

    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    const run = runRows[0];

    if (run.status !== 'active') {
      return res.status(400).json({ error: 'Run is not active' });
    }

    if (new Date(run.ends_at) > new Date()) {
      return res.status(400).json({ error: 'Dungeon run has not finished yet' });
    }

    const attacker = {
      attack: run.attack,
      defense: run.defense + (run.boost_defense || 0),
      chance: run.chance + (run.boost_chance || 0),
      max_hp: run.max_hp + (run.boost_hp || 0),
      current_hp: run.current_hp + (run.boost_hp || 0), // start from actual HP, not max
    };
    const defender = { attack: run.enemy_attack, defense: run.enemy_defense, chance: run.enemy_chance, max_hp: run.enemy_hp };
    const result = simulateCombat(attacker, defender);

    const winner = result.winner === 'attacker' ? 'champion' : 'enemy';
    const rewardResource = run.reward_resource;
    const rewardAmount = winner === 'champion' ? run.reward_amount : 0;

    await query(
      `UPDATE dungeon_runs SET status = 'claimed', winner = $1, battle_log = $2, reward_resource = $3, reward_amount = $4 WHERE id = $5`,
      [winner, JSON.stringify(result.log), rewardResource, rewardAmount, runId]
    );

    // XP gain (only on victory)
    let xpGained = 0;
    let levelsGained = 0;
    let newLevel = run.level;
    let newXp = run.xp;
    let newXpToNext = run.xp_to_next_level;

    if (winner === 'champion' && run.xp_reward > 0) {
      xpGained = run.xp_reward;
      newXp += xpGained;
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel++;
        newXpToNext = newLevel * 100;
        levelsGained++;
      }
    }

    // Update champion: HP + XP + level + stat points + clear boosts
    // Cap current_hp at max_hp since boost_hp is being cleared
    const finalHp = Math.min(result.attackerHpLeft, run.max_hp);
    await query(
      'UPDATE champions SET is_deployed = FALSE, current_hp = $1, xp = $2, level = $3, xp_to_next_level = $4, stat_points = stat_points + $5, boost_hp = 0, boost_defense = 0, boost_chance = 0 WHERE id = $6',
      [finalHp, newXp, newLevel, newXpToNext, levelsGained, run.champion_id]
    );

    // Unlock PvP for this player if any champion reached level 3
    if (newLevel >= 3) {
      await query('UPDATE players SET pvp_unlocked = TRUE WHERE id = $1 AND pvp_unlocked = FALSE', [playerId]);
    }

    if (rewardAmount > 0) {
      const rewardCapCol = `${rewardResource}_cap`;
      await query(
        `UPDATE player_resources SET ${rewardResource} = LEAST(${rewardResource} + $1, ${rewardCapCol}) WHERE player_id = $2`,
        [rewardAmount, playerId]
      );
      // Fill pvp_storage (loot pool) when resources are earned, capped at 500
      const storageCol = `pvp_storage_${rewardResource}`;
      await query(
        `UPDATE players SET ${storageCol} = LEAST(${storageCol} + $1, 500) WHERE id = $2`,
        [rewardAmount, playerId]
      );
    }

    res.json({ winner, rewardResource, rewardAmount, log: result.log, xpGained, levelsGained, newLevel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim run' });
  }
}

module.exports = { listDungeons, enterDungeon, getActiveRuns, claimRun };
