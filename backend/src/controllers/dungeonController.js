const { query } = require('../db');
const { simulateCombat, simulateBossCombat } = require('../combat');
const { incrementQuestProgress } = require('../quests');
const { getChampionGearBonuses, getChampionEquippedGearSnapshot, rollGearDrop } = require('../routes/gear');

const MAIN_RESOURCES = ['strawberry', 'pinecone', 'blueberry'];

async function listDungeons(req, res) {
  try {
    const type = req.query.type;
    const params = [];
    const conditions = [];

    if (type) {
      conditions.push(`dungeon_type = $${params.length + 1}`);
      params.push(type);
    }

    // Always exclude expired event dungeons
    conditions.push(`(dungeon_type != 'event' OR event_ends_at IS NULL OR event_ends_at > NOW())`);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT * FROM dungeons ${whereClause} ORDER BY COALESCE(stage_number, 9999), duration_minutes ASC`;
    const dungeons = await query(sql, params);
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
      // Auto-fix: if deployed but no active run or pending PvP battle, clear the stuck state
      const [activeRun, pendingBattle] = await Promise.all([
        query(`SELECT id FROM dungeon_runs WHERE champion_id = $1 AND status = 'active'`, [champion_id]),
        query(`SELECT id FROM pvp_battles WHERE attacker_champion_id = $1 AND status = 'pending'`, [champion_id]),
      ]);
      if (activeRun.length === 0 && pendingBattle.length === 0) {
        await query('UPDATE champions SET is_deployed = FALSE WHERE id = $1', [champion_id]);
        champion.is_deployed = false;
      } else {
        return res.status(400).json({ error: 'Champion is already deployed' });
      }
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

    // Champion level requirement check
    if (dungeon.min_champion_level && champion.level < dungeon.min_champion_level) {
      return res.status(400).json({
        error: `Bu zindana girmek için şampiyon seviyesi ${dungeon.min_champion_level} olmalı.`,
        required_level: dungeon.min_champion_level,
      });
    }

    // ── Type-specific guards ──────────────────────────────────────────────────

    // Harvest: cooldown + daily limit check
    if (dungeon.dungeon_type === 'harvest') {
      const cooldownRow = await query(
        `SELECT last_run_at, runs_today, day_reset_at FROM harvest_cooldowns WHERE player_id=$1 AND dungeon_id=$2`,
        [playerId, dungeonId]
      );
      if (cooldownRow.length > 0) {
        const row = cooldownRow[0];
        if (dungeon.cooldown_minutes) {
          const cooldownMs = dungeon.cooldown_minutes * 60 * 1000;
          const elapsed = Date.now() - new Date(row.last_run_at).getTime();
          if (elapsed < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
            return res.status(400).json({ error: 'Dungeon on cooldown', remaining_seconds: remaining });
          }
        }
        if (dungeon.daily_run_limit) {
          const today = new Date().toISOString().slice(0, 10);
          const rowDate = row.day_reset_at instanceof Date
            ? row.day_reset_at.toISOString().slice(0, 10)
            : String(row.day_reset_at).slice(0, 10);
          if (rowDate === today && row.runs_today >= dungeon.daily_run_limit) {
            return res.status(400).json({ error: 'Daily run limit reached' });
          }
        }
      }
    }

    // Adventure: level gate — entering any dungeon in level N requires boss of level N-1 cleared
    if (dungeon.dungeon_type === 'adventure' && dungeon.dungeon_level > 1) {
      const prevBossStageNum = (dungeon.dungeon_level - 1) * 10;
      const prevBossRows = await query(
        `SELECT d.id FROM dungeons d WHERE d.dungeon_type = 'adventure' AND d.stage_number = $1`,
        [prevBossStageNum]
      );
      if (prevBossRows.length > 0) {
        const cleared = await query(
          `SELECT 1 FROM adventure_progress WHERE player_id = $1 AND dungeon_id = $2 AND best_stars > 0`,
          [playerId, prevBossRows[0].id]
        );
        if (cleared.length === 0) {
          return res.status(400).json({
            error: `Seviye ${dungeon.dungeon_level}'e geçmek için önceki seviyenin boss savaşını kazanmalısınız.`,
            required_boss_stage: prevBossStageNum,
          });
        }
      }
    }

    // Adventure: stage sequence lock (must clear stage N-1 before entering stage N)
    if (dungeon.dungeon_type === 'adventure' && dungeon.stage_number > 1) {
      const prevStage = await query(
        `SELECT ap.id FROM dungeons d
         JOIN adventure_progress ap ON ap.dungeon_id = d.id AND ap.player_id = $1
         WHERE d.stage_number = $2 AND d.dungeon_type = 'adventure' AND ap.best_stars > 0`,
        [playerId, dungeon.stage_number - 1]
      );
      if (prevStage.length === 0) {
        return res.status(400).json({ error: 'Complete the previous stage first' });
      }
    }

    // Boss: require and validate second champion
    if (dungeon.is_boss_stage) {
      const { champion_id_2 } = req.body;
      if (!champion_id_2) {
        return res.status(400).json({ error: 'Boss savaşı için ikinci bir şampiyon seçmelisiniz.' });
      }
      if (champion_id_2 === champion_id) {
        return res.status(400).json({ error: 'Aynı şampiyonu iki kez seçemezsiniz.' });
      }
      const champ2Rows = await query(
        'SELECT id, is_deployed, last_defender FROM champions WHERE id = $1 AND player_id = $2',
        [champion_id_2, playerId]
      );
      if (champ2Rows.length === 0) {
        return res.status(404).json({ error: 'İkinci şampiyon bulunamadı.' });
      }
      if (champ2Rows[0].is_deployed) {
        return res.status(400).json({ error: 'İkinci şampiyon başka bir görevde.' });
      }
    }

    // Event: time window check
    if (dungeon.dungeon_type === 'event') {
      const now = new Date();
      if (dungeon.event_ends_at && new Date(dungeon.event_ends_at) < now) {
        return res.status(400).json({ error: 'Event has ended' });
      }
      if (dungeon.event_starts_at && new Date(dungeon.event_starts_at) > now) {
        return res.status(400).json({ error: 'Event has not started yet' });
      }
    }

    const durationMs = dungeon.duration_seconds
      ? dungeon.duration_seconds * 1000
      : dungeon.duration_minutes * 60 * 1000;
    const endsAt = new Date(Date.now() + durationMs);

    const { champion_id_2 } = req.body;
    const runRows = await query(
      `INSERT INTO dungeon_runs (player_id, champion_id, dungeon_id, ends_at, champion_id_2)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [playerId, champion_id, dungeonId, endsAt, dungeon.is_boss_stage ? (champion_id_2 ?? null) : null]
    );

    await query('UPDATE champions SET is_deployed = TRUE WHERE id = $1', [champion_id]);
    if (dungeon.is_boss_stage && champion_id_2) {
      await query('UPDATE champions SET is_deployed = TRUE WHERE id = $1', [champion_id_2]);
    }

    // Quest progress — entering an adventure dungeon
    if (dungeon.dungeon_type === 'adventure') {
      await incrementQuestProgress(playerId, 'dungeon_enter_adventure');
    }

    // Harvest: upsert cooldown record
    if (dungeon.dungeon_type === 'harvest') {
      await query(`
        INSERT INTO harvest_cooldowns (player_id, dungeon_id, last_run_at, runs_today, day_reset_at)
        VALUES ($1, $2, NOW(), 1, CURRENT_DATE)
        ON CONFLICT (player_id, dungeon_id) DO UPDATE
        SET last_run_at = NOW(),
            runs_today = CASE
              WHEN harvest_cooldowns.day_reset_at < CURRENT_DATE THEN 1
              ELSE harvest_cooldowns.runs_today + 1
            END,
            day_reset_at = CURRENT_DATE
      `, [playerId, dungeonId]);
    }

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
      `SELECT dr.*, c.name AS champion_name, c.class AS champion_class, c.attack, c.defense, c.chance, c.max_hp,
              d.name AS dungeon_name, d.enemy_name, d.enemy_attack, d.enemy_defense,
              d.enemy_chance, d.enemy_hp, d.reward_resource, d.reward_amount,
              d.dungeon_type, d.reward_resource_2, d.reward_amount_2, d.is_boss_stage,
              c2.name AS champion2_name,
              c2.class AS champion2_class
       FROM dungeon_runs dr
       JOIN champions c ON c.id = dr.champion_id
       JOIN dungeons d ON d.id = dr.dungeon_id
       LEFT JOIN champions c2 ON c2.id = dr.champion_id_2
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
              c.boost_hp, c.boost_defense, c.boost_chance, c.boost_attack,
              d.name AS dungeon_name, d.enemy_name, d.enemy_attack, d.enemy_defense, d.enemy_chance, d.enemy_hp,
              d.reward_resource, d.reward_amount, d.xp_reward,
              d.dungeon_type, d.coin_reward, d.reward_resource_2, d.reward_amount_2,
              d.reward_multiplier, d.stage_number, d.is_boss_stage, d.dungeon_level,
              d.extra_rewards, d.min_champion_level
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

    // champion.boost_hp/defense/chance already include food boosts (written by /use endpoint)
    // Gear bonuses are capped at 50% of champion's base stat to prevent PvP imbalance
    const rawGear = await getChampionGearBonuses(run.champion_id);
    const gearBonuses = {
      attack:  Math.min(rawGear.attack,  Math.floor(run.attack  * 0.5)),
      defense: Math.min(rawGear.defense, Math.floor(run.defense * 0.5)),
      chance:  Math.min(rawGear.chance,  Math.floor(run.chance  * 0.5)),
    };
    const attacker = {
      attack:  run.attack  + (run.boost_attack  || 0) + gearBonuses.attack,
      defense: run.defense + (run.boost_defense || 0) + gearBonuses.defense,
      chance:  run.chance  + (run.boost_chance  || 0) + gearBonuses.chance,
      max_hp:  run.max_hp  + (run.boost_hp      || 0),
      current_hp: run.current_hp + (run.boost_hp || 0),
    };
    const defender = { attack: run.enemy_attack, defense: run.enemy_defense, chance: run.enemy_chance, max_hp: run.enemy_hp };

    const isBossBattle = !!run.champion_id_2;
    let result;
    let winner;
    let champ2 = null;
    let attacker2 = null;
    let champ2FinalHp = null;
    let champ2XpGained = 0;
    let champ2LevelsGained = 0;
    let champ2NewLevel = null;

    if (isBossBattle) {
      // Fetch champion 2 stats + gear bonuses
      const champ2Rows = await query('SELECT * FROM champions WHERE id = $1', [run.champion_id_2]);
      if (champ2Rows.length === 0) throw new Error('Champion 2 not found for boss battle');
      champ2 = champ2Rows[0];
      const rawGear2 = await getChampionGearBonuses(champ2.id);
      const gearBonuses2 = {
        attack:  Math.min(rawGear2.attack,  Math.floor(champ2.attack  * 0.5)),
        defense: Math.min(rawGear2.defense, Math.floor(champ2.defense * 0.5)),
        chance:  Math.min(rawGear2.chance,  Math.floor(champ2.chance  * 0.5)),
      };
      attacker2 = {
        attack:  champ2.attack  + (champ2.boost_attack  || 0) + gearBonuses2.attack,
        defense: champ2.defense + (champ2.boost_defense || 0) + gearBonuses2.defense,
        chance:  champ2.chance  + (champ2.boost_chance  || 0) + gearBonuses2.chance,
        max_hp:  champ2.max_hp  + (champ2.boost_hp      || 0),
        current_hp: champ2.current_hp + (champ2.boost_hp || 0),
      };
      result = simulateBossCombat(attacker, attacker2, defender);
      winner = result.winner === 'attacker' ? 'champion' : 'enemy';
    } else {
      result = simulateCombat(attacker, defender);
      winner = result.winner === 'attacker' ? 'champion' : 'enemy';
    }

    // Check if this adventure dungeon was already cleared before (for reward reduction)
    let alreadyCleared = false;
    if (run.dungeon_type === 'adventure' && !(run.dungeon_name || '').startsWith('[TEST]')) {
      const prevProgress = await query(
        `SELECT best_stars FROM adventure_progress WHERE player_id = $1 AND dungeon_id = $2 AND best_stars > 0`,
        [playerId, run.dungeon_id]
      );
      alreadyCleared = prevProgress.length > 0;
    }

    const multiplier = run.reward_multiplier || 1.0;
    const rewardResource = run.reward_resource;
    // Already-cleared adventure dungeons give minimal rewards to discourage farming
    const effectiveAmount = winner !== 'champion' ? 0
      : alreadyCleared ? 1
      : Math.floor(run.reward_amount * multiplier);
    const effectiveAmount2 = winner !== 'champion' ? 0
      : alreadyCleared ? (run.reward_resource_2 ? 1 : 0)
      : Math.floor((run.reward_amount_2 || 0) * multiplier);
    const coinReward = winner === 'champion' && run.dungeon_type === 'adventure' && !alreadyCleared ? (run.coin_reward || 0) : 0;

    // Calculate stars (adventure only) — boss uses combined HP of both champions
    let starsEarned = null;
    if (run.dungeon_type === 'adventure') {
      if (winner === 'champion') {
        let hpPct;
        if (isBossBattle && champ2) {
          const combinedHpLeft = result.attackerHpLeft + (result.attacker2HpLeft || 0);
          const combinedMaxHp = (run.max_hp + (run.boost_hp || 0)) + (champ2.max_hp + (champ2.boost_hp || 0));
          hpPct = combinedHpLeft / combinedMaxHp;
        } else {
          hpPct = result.attackerHpLeft / (run.max_hp + (run.boost_hp || 0));
        }
        starsEarned = hpPct >= 0.9 ? 3 : hpPct > 0.5 ? 2 : 1;
      } else {
        starsEarned = 0;
      }
    }

    await query(
      `UPDATE dungeon_runs SET status = 'claimed', winner = $1, battle_log = $2, reward_resource = $3, reward_amount = $4, stars_earned = $5 WHERE id = $6`,
      [winner, JSON.stringify(result.log), rewardResource, effectiveAmount, starsEarned, runId]
    );

    // ── Quest progress ────────────────────────────────────────────────────────
    if (winner === 'champion') {
      if (run.dungeon_type === 'harvest') {
        await incrementQuestProgress(playerId, 'dungeon_claim_harvest');
      } else if (run.dungeon_type === 'adventure') {
        await incrementQuestProgress(playerId, 'dungeon_claim_adventure', {
          stars:  starsEarned,
          isBoss: !!run.is_boss_stage,
        });
      }
    }

    // XP gain (only on victory, only for dungeons with xp_reward > 0)
    let xpGained = 0;
    let levelsGained = 0;
    let newLevel = run.level;
    let newXp = run.xp;
    let newXpToNext = run.xp_to_next_level;

    if (winner === 'champion' && run.xp_reward > 0) {
      xpGained = alreadyCleared ? 1 : run.xp_reward;
      newXp += xpGained;
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel++;
        newXpToNext = newLevel * 100;
        levelsGained++;
      }
    }

    // Update champion 1: HP + XP + level + stat points + restore timed boosts (zero one-shots)
    const finalHp = Math.round(Math.min(result.attackerHpLeft, run.max_hp));
    await query(
      `UPDATE champions SET is_deployed = FALSE, current_hp = $1, xp = $2, level = $3, xp_to_next_level = $4, stat_points = stat_points + $5,
        boost_hp      = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_hp'      AND is_one_shot = FALSE AND expires_at > NOW()),
        boost_defense = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_defense' AND is_one_shot = FALSE AND expires_at > NOW()),
        boost_chance  = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_chance'  AND is_one_shot = FALSE AND expires_at > NOW()),
        boost_attack  = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_attack'  AND is_one_shot = FALSE AND expires_at > NOW())
       WHERE id = $6`,
      [finalHp, newXp, newLevel, newXpToNext, levelsGained, run.champion_id]
    );

    // Delete one-shot food boosts for champion 1
    await query(`DELETE FROM active_boosts WHERE entity_id = $1 AND is_one_shot = TRUE`, [run.champion_id]);

    // Champion 2 post-battle (boss runs only)
    if (isBossBattle && champ2) {
      champ2FinalHp = Math.round(Math.min(result.attacker2HpLeft || 0, champ2.max_hp));
      const xpReward2 = winner === 'champion' && run.xp_reward > 0 ? (alreadyCleared ? 1 : run.xp_reward) : 0;
      champ2XpGained = xpReward2;
      let c2NewXp = champ2.xp + xpReward2;
      let c2NewLevel = champ2.level;
      let c2NewXpToNext = champ2.xp_to_next_level;
      while (c2NewXp >= c2NewXpToNext) {
        c2NewXp -= c2NewXpToNext;
        c2NewLevel++;
        c2NewXpToNext = c2NewLevel * 100;
        champ2LevelsGained++;
      }
      champ2NewLevel = c2NewLevel;
      await query(
        `UPDATE champions SET is_deployed = FALSE, current_hp = $1, xp = $2, level = $3, xp_to_next_level = $4, stat_points = stat_points + $5,
          boost_hp      = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_hp'      AND is_one_shot = FALSE AND expires_at > NOW()),
          boost_defense = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_defense' AND is_one_shot = FALSE AND expires_at > NOW()),
          boost_chance  = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_chance'  AND is_one_shot = FALSE AND expires_at > NOW()),
          boost_attack  = (SELECT COALESCE(SUM(boost_value),0) FROM active_boosts WHERE entity_id = $6 AND boost_type = 'boost_attack'  AND is_one_shot = FALSE AND expires_at > NOW())
         WHERE id = $6`,
        [champ2FinalHp, c2NewXp, c2NewLevel, c2NewXpToNext, champ2LevelsGained, champ2.id]
      );
      await query(`DELETE FROM active_boosts WHERE entity_id = $1 AND is_one_shot = TRUE`, [champ2.id]);
      if (c2NewLevel >= 3) {
        await query('UPDATE players SET pvp_unlocked = TRUE WHERE id = $1 AND pvp_unlocked = FALSE', [playerId]);
      }
    }

    // Unlock PvP for this player if any champion reached level 3
    if (newLevel >= 3) {
      await query('UPDATE players SET pvp_unlocked = TRUE WHERE id = $1 AND pvp_unlocked = FALSE', [playerId]);
    }

    // Award primary resource
    if (effectiveAmount > 0) {
      const rewardCapCol = `${rewardResource}_cap`;
      await query(
        `UPDATE player_resources SET ${rewardResource} = LEAST(${rewardResource} + $1, ${rewardCapCol}) WHERE player_id = $2`,
        [effectiveAmount, playerId]
      );
      // Fill pvp_storage for main resources only
      if (MAIN_RESOURCES.includes(rewardResource)) {
        const storageCol = `pvp_storage_${rewardResource}`;
        await query(
          `UPDATE players SET ${storageCol} = LEAST(${storageCol} + $1, 500) WHERE id = $2`,
          [effectiveAmount, playerId]
        );
      }
    }

    // Award secondary resource (harvest dual-reward)
    if (effectiveAmount2 > 0 && run.reward_resource_2) {
      const cap2Col = `${run.reward_resource_2}_cap`;
      await query(
        `UPDATE player_resources SET ${run.reward_resource_2} = LEAST(${run.reward_resource_2} + $1, ${cap2Col}) WHERE player_id = $2`,
        [effectiveAmount2, playerId]
      );
      if (MAIN_RESOURCES.includes(run.reward_resource_2)) {
        const storageCol2 = `pvp_storage_${run.reward_resource_2}`;
        await query(
          `UPDATE players SET ${storageCol2} = LEAST(${storageCol2} + $1, 500) WHERE id = $2`,
          [effectiveAmount2, playerId]
        );
      }
    }

    // Award extra_rewards (multi-resource harvest dungeons)
    const extraRewards = run.extra_rewards || [];
    for (const r of extraRewards) {
      if (winner === 'champion' && r.resource && r.amount > 0) {
        const capCol = `${r.resource}_cap`;
        const effectiveExtra = alreadyCleared ? 1 : r.amount;
        await query(
          `UPDATE player_resources SET ${r.resource} = LEAST(${r.resource} + $1, ${capCol}) WHERE player_id = $2`,
          [effectiveExtra, playerId]
        );
      }
    }

    // Award coins for adventure dungeons
    if (coinReward > 0) {
      await query('UPDATE players SET coins = coins + $1 WHERE id = $2', [coinReward, playerId]);
    }

    // Update adventure progress
    if (run.dungeon_type === 'adventure' && starsEarned !== null) {
      await query(`
        INSERT INTO adventure_progress (player_id, dungeon_id, best_stars, cleared_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (player_id, dungeon_id) DO UPDATE
        SET best_stars = GREATEST(adventure_progress.best_stars, EXCLUDED.best_stars),
            cleared_at = CASE
              WHEN EXCLUDED.best_stars > 0 AND adventure_progress.cleared_at IS NULL
              THEN EXCLUDED.cleared_at
              ELSE adventure_progress.cleared_at
            END
      `, [playerId, run.dungeon_id, starsEarned, winner === 'champion' ? new Date() : null]);
    }

    // ── Gear drop roll (adventure + event only, never harvest) ────────────────
    let gearDrops = [];
    if (winner === 'champion' && run.dungeon_type !== 'harvest') {
      gearDrops = await rollGearDrop(run, playerId);
    }

    // ── Champion gear snapshot (for battle history display) ───────────────────
    const championGear = await getChampionEquippedGearSnapshot(run.champion_id);

    res.json({
      winner,
      enemyName: run.enemy_name || null,
      rewardResource,
      rewardAmount: effectiveAmount,
      rewardResource2: run.reward_resource_2 || null,
      rewardAmount2: effectiveAmount2,
      coinReward,
      starsEarned,
      log: result.log,
      xpGained,
      levelsGained,
      newLevel,
      gearDrops,
      championGear,
      extraRewards: extraRewards.length > 0 ? extraRewards : undefined,
      // Boss battle extras
      isBossBattle: isBossBattle || undefined,
      champion2Name: champ2?.name || undefined,
      champion2Class: champ2?.class || undefined,
      champion2HpLeft: champ2FinalHp ?? undefined,
      champion2XpGained: champ2XpGained || undefined,
      champion2LevelsGained: champ2LevelsGained || undefined,
      champion2NewLevel: champ2NewLevel ?? undefined,
      // Starting stats for battle history display
      championStartStats: !isBossBattle ? { attack: attacker.attack, defense: attacker.defense, chance: attacker.chance, hp: attacker.current_hp ?? attacker.max_hp } : undefined,
      enemyStartStats: !isBossBattle ? { attack: defender.attack, defense: defender.defense, chance: defender.chance, hp: defender.max_hp } : undefined,
      c1StartStats: isBossBattle ? { attack: attacker.attack, defense: attacker.defense, chance: attacker.chance, hp: attacker.current_hp } : undefined,
      c2StartStats: isBossBattle && champ2 ? { attack: attacker2.attack, defense: attacker2.defense, chance: attacker2.chance, hp: attacker2.current_hp } : undefined,
      bossStartStats: isBossBattle ? { attack: defender.attack, defense: defender.defense, chance: defender.chance, hp: defender.max_hp } : undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim run' });
  }
}

async function getAdventureProgress(req, res) {
  const playerId = req.player.id;
  try {
    const rows = await query(
      `SELECT ap.dungeon_id, ap.best_stars, ap.cleared_at, d.stage_number, d.name
       FROM adventure_progress ap
       JOIN dungeons d ON d.id = ap.dungeon_id
       WHERE ap.player_id = $1
       ORDER BY d.stage_number`,
      [playerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch adventure progress' });
  }
}

async function getHarvestCooldowns(req, res) {
  const playerId = req.player.id;
  try {
    const rows = await query(
      `SELECT hc.dungeon_id, hc.last_run_at,
              CASE WHEN hc.day_reset_at < CURRENT_DATE THEN 0 ELSE hc.runs_today END AS runs_today,
              hc.day_reset_at, d.cooldown_minutes, d.daily_run_limit
       FROM harvest_cooldowns hc
       JOIN dungeons d ON d.id = hc.dungeon_id
       WHERE hc.player_id = $1`,
      [playerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch harvest cooldowns' });
  }
}

async function getMilestones(req, res) {
  const playerId = req.player.id;
  try {
    const [milestones, claims, totalResult] = await Promise.all([
      query('SELECT * FROM adventure_star_milestones ORDER BY required_stars'),
      query('SELECT required_stars FROM adventure_milestone_claims WHERE player_id = $1', [playerId]),
      query('SELECT COALESCE(SUM(best_stars), 0) AS total FROM adventure_progress WHERE player_id = $1', [playerId]),
    ]);
    const claimedSet = new Set(claims.map(c => c.required_stars));
    const totalStars = parseInt(totalResult[0].total);
    const merged = milestones.map(m => ({
      ...m,
      claimed: claimedSet.has(m.required_stars),
    }));
    res.json({ milestones: merged, total_stars: totalStars });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
}

async function claimMilestone(req, res) {
  const playerId = req.player.id;
  const requiredStars = parseInt(req.params.requiredStars);

  try {
    // Get milestone definition
    const milestoneRows = await query(
      'SELECT * FROM adventure_star_milestones WHERE required_stars = $1',
      [requiredStars]
    );
    if (milestoneRows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    const milestone = milestoneRows[0];

    // Check already claimed
    const claimRows = await query(
      'SELECT 1 FROM adventure_milestone_claims WHERE player_id = $1 AND required_stars = $2',
      [playerId, requiredStars]
    );
    if (claimRows.length > 0) {
      return res.status(400).json({ error: 'Milestone already claimed' });
    }

    // Check player has enough stars
    const totalResult = await query(
      'SELECT COALESCE(SUM(best_stars), 0) AS total FROM adventure_progress WHERE player_id = $1',
      [playerId]
    );
    const totalStars = parseInt(totalResult[0].total);
    if (totalStars < requiredStars) {
      return res.status(400).json({ error: 'Not enough stars', total_stars: totalStars, required: requiredStars });
    }

    // Record claim
    await query(
      'INSERT INTO adventure_milestone_claims (player_id, required_stars) VALUES ($1, $2)',
      [playerId, requiredStars]
    );

    // Award rewards
    if (milestone.reward_coins > 0) {
      await query('UPDATE players SET coins = coins + $1 WHERE id = $2', [milestone.reward_coins, playerId]);
    }
    if (milestone.reward_resource && milestone.reward_amount > 0) {
      const capCol = `${milestone.reward_resource}_cap`;
      await query(
        `UPDATE player_resources SET ${milestone.reward_resource} = LEAST(${milestone.reward_resource} + $1, ${capCol}) WHERE player_id = $2`,
        [milestone.reward_amount, playerId]
      );
    }

    res.json({ success: true, coins_awarded: milestone.reward_coins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim milestone' });
  }
}

module.exports = {
  listDungeons,
  enterDungeon,
  getActiveRuns,
  claimRun,
  getAdventureProgress,
  getHarvestCooldowns,
  getMilestones,
  claimMilestone,
};
