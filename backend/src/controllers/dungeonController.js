const { query } = require('../db');
const { simulateCombat } = require('../combat');
const { incrementQuestProgress } = require('../quests');

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

    // Adventure: stage lock check
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

    const runRows = await query(
      `INSERT INTO dungeon_runs (player_id, champion_id, dungeon_id, ends_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [playerId, champion_id, dungeonId, endsAt]
    );

    await query('UPDATE champions SET is_deployed = TRUE WHERE id = $1', [champion_id]);

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
      `SELECT dr.*, c.name AS champion_name, c.attack, c.defense, c.chance, c.max_hp,
              d.name AS dungeon_name, d.enemy_name, d.enemy_attack, d.enemy_defense,
              d.enemy_chance, d.enemy_hp, d.reward_resource, d.reward_amount,
              d.dungeon_type, d.reward_resource_2, d.reward_amount_2
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
              d.reward_resource, d.reward_amount, d.xp_reward,
              d.dungeon_type, d.coin_reward, d.reward_resource_2, d.reward_amount_2,
              d.reward_multiplier, d.stage_number, d.is_boss_stage
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
    const attacker = {
      attack: run.attack,
      defense: run.defense + (run.boost_defense || 0),
      chance: run.chance + (run.boost_chance || 0),
      max_hp: run.max_hp + (run.boost_hp || 0),
      current_hp: run.current_hp + (run.boost_hp || 0),
    };
    const defender = { attack: run.enemy_attack, defense: run.enemy_defense, chance: run.enemy_chance, max_hp: run.enemy_hp };
    const result = simulateCombat(attacker, defender);

    const winner = result.winner === 'attacker' ? 'champion' : 'enemy';
    const multiplier = run.reward_multiplier || 1.0;
    const rewardResource = run.reward_resource;
    const effectiveAmount = winner === 'champion' ? Math.floor(run.reward_amount * multiplier) : 0;
    const effectiveAmount2 = winner === 'champion' ? Math.floor((run.reward_amount_2 || 0) * multiplier) : 0;
    const coinReward = winner === 'champion' && run.dungeon_type === 'adventure' ? (run.coin_reward || 0) : 0;

    // Calculate stars (adventure only)
    let starsEarned = null;
    if (run.dungeon_type === 'adventure') {
      if (winner === 'champion') {
        const hpPct = result.attackerHpLeft / (run.max_hp + (run.boost_hp || 0));
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
      xpGained = run.xp_reward;
      newXp += xpGained;
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel++;
        newXpToNext = newLevel * 100;
        levelsGained++;
      }
    }

    // Update champion: HP + XP + level + stat points + clear legacy boost columns
    const finalHp = Math.min(result.attackerHpLeft, run.max_hp);
    await query(
      'UPDATE champions SET is_deployed = FALSE, current_hp = $1, xp = $2, level = $3, xp_to_next_level = $4, stat_points = stat_points + $5, boost_hp = 0, boost_defense = 0, boost_chance = 0 WHERE id = $6',
      [finalHp, newXp, newLevel, newXpToNext, levelsGained, run.champion_id]
    );

    // Delete one-shot food boosts for this champion (consumed by the battle)
    await query(
      `DELETE FROM active_boosts WHERE entity_id = $1 AND is_one_shot = TRUE`,
      [run.champion_id]
    );

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

    res.json({
      winner,
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
      `SELECT hc.dungeon_id, hc.last_run_at, hc.runs_today, hc.day_reset_at,
              d.cooldown_minutes, d.daily_run_limit
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
