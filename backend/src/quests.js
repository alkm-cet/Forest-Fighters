const { query } = require('./db');

// ── Period key helpers ────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getPeriodKey(questType) {
  const now = new Date();
  if (questType === 'daily') {
    return 'daily:' + now.toISOString().slice(0, 10); // 'daily:2026-04-15'
  }
  const week = getISOWeek(now);
  return `weekly:${now.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Player tier (based on trophies, aligned with PvP leagues) ────────────────
// t1 = Bronz (0–149), t2 = Gumus+Altin (150–499), t3 = Platinium+ (500+)

function getPlayerTier(trophies) {
  if (trophies >= 500) return 't3';
  if (trophies >= 150) return 't2';
  return 't1';
}

function scaleValue(base, scaleFactors, tier) {
  const factor = (scaleFactors && scaleFactors[tier]) ? scaleFactors[tier] : 1.0;
  return Math.max(1, Math.round(base * factor));
}

// ── Metadata filter ───────────────────────────────────────────────────────────
// questMeta = filter criteria on the definition (what the quest requires)
// callMeta  = context provided at the call site (what actually happened)

function metaMatches(questMeta, callMeta) {
  if (!questMeta || Object.keys(questMeta).length === 0) return true;
  if (questMeta.resourceType  && questMeta.resourceType  !== callMeta.resourceType)  return false;
  if (questMeta.championClass && questMeta.championClass !== callMeta.championClass) return false;
  if (questMeta.animalType    && questMeta.animalType    !== callMeta.animalType)    return false;
  if (questMeta.dungeonType   && questMeta.dungeonType   !== callMeta.dungeonType)   return false;
  if (questMeta.isBoss        && !callMeta.isBoss)                                   return false;
  if (questMeta.minStars !== undefined && (callMeta.stars ?? 0) < questMeta.minStars) return false;
  return true;
}

// ── Assign quests for a period if not yet done ────────────────────────────────

async function ensureQuestsAssigned(playerId, questType) {
  const periodKey = getPeriodKey(questType);

  // Fast path: already have the full set for this period (4 quests each)
  const existing = await query(
    'SELECT COUNT(*) AS cnt FROM player_quests WHERE player_id = $1 AND period_key = $2',
    [playerId, periodKey]
  );
  if (parseInt(existing[0].cnt, 10) >= 4) return;

  // Fetch player trophies to determine tier
  const playerRows = await query('SELECT trophies FROM players WHERE id = $1', [playerId]);
  const trophies = playerRows[0]?.trophies ?? 10;
  const tier = getPlayerTier(trophies);

  if (questType === 'daily') {
    const pools = ['easy', 'medium', 'action', 'passive'];
    for (const difficulty of pools) {
      const defs = await query(
        `SELECT * FROM quest_definitions
          WHERE quest_type = 'daily' AND difficulty = $1 AND is_active = TRUE`,
        [difficulty]
      );
      if (defs.length === 0) continue;
      const picked = defs[Math.floor(Math.random() * defs.length)];
      const scaledTarget = scaleValue(picked.target_count, picked.scale_factors, tier);
      const scaledReward = picked.reward_coins; // rewards are fixed — only targets scale
      await query(
        `INSERT INTO player_quests
           (player_id, definition_id, quest_type, period_key, target_count, reward_coins, metadata)
         VALUES ($1, $2, 'daily', $3, $4, $5, $6::jsonb)
         ON CONFLICT (player_id, period_key, definition_id) DO NOTHING`,
        [playerId, picked.id, periodKey, scaledTarget, scaledReward, JSON.stringify(picked.metadata)]
      );
    }
  } else {
    // Weekly: 1 weekly_easy + 1 weekly_medium + 2 weekly_hard
    const plan = [
      { difficulty: 'weekly_easy',   count: 1 },
      { difficulty: 'weekly_medium', count: 1 },
      { difficulty: 'weekly_hard',   count: 2 },
    ];
    for (const { difficulty, count } of plan) {
      const defs = await query(
        `SELECT * FROM quest_definitions
          WHERE quest_type = 'weekly' AND difficulty = $1 AND is_active = TRUE`,
        [difficulty]
      );
      if (defs.length === 0) continue;
      // Shuffle and pick `count` without replacement
      const shuffled = defs.sort(() => Math.random() - 0.5);
      const picks = shuffled.slice(0, Math.min(count, shuffled.length));
      for (const picked of picks) {
        const scaledTarget = scaleValue(picked.target_count, picked.scale_factors, tier);
        const scaledReward = picked.reward_coins; // rewards are fixed — only targets scale
        await query(
          `INSERT INTO player_quests
             (player_id, definition_id, quest_type, period_key, target_count, reward_coins, metadata)
           VALUES ($1, $2, 'weekly', $3, $4, $5, $6::jsonb)
           ON CONFLICT (player_id, period_key, definition_id) DO NOTHING`,
          [playerId, picked.id, periodKey, scaledTarget, scaledReward, JSON.stringify(picked.metadata)]
        );
      }
    }
  }
}

// ── Increment quest progress ───────────────────────────────────────────────────
// Fire-and-forget from route handlers. Never throws — quest bugs must not
// break the calling endpoint.
//
// meta fields:
//   amount?       (number)  — variable increment, defaults to 1
//   resourceType? (string)  — matched against quest metadata filter
//   championClass?(string)  — matched against quest metadata filter
//   animalType?   (string)  — matched against quest metadata filter
//   isBoss?       (boolean) — matched against quest metadata filter
//   stars?        (number)  — matched against quest metadata minStars filter

async function incrementQuestProgress(playerId, actionKey, meta = {}) {
  try {
    const dailyKey  = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const increment = (typeof meta.amount === 'number' && meta.amount > 0) ? meta.amount : 1;

    const rows = await query(
      `SELECT pq.id, pq.progress, pq.target_count, pq.metadata
         FROM player_quests pq
         JOIN quest_definitions qd ON qd.id = pq.definition_id
        WHERE pq.player_id = $1
          AND pq.status = 'in_progress'
          AND pq.period_key IN ($2, $3)
          AND qd.action_key = $4`,
      [playerId, dailyKey, weeklyKey, actionKey]
    );

    for (const row of rows) {
      if (!metaMatches(row.metadata, meta)) continue;

      // LEAST(...) is fully in SQL — safe under concurrent requests.
      // AND status = 'in_progress' guard makes this idempotent.
      await query(
        `UPDATE player_quests
            SET progress     = LEAST(progress + $1, target_count),
                status       = CASE
                                 WHEN LEAST(progress + $1, target_count) >= target_count
                                 THEN 'completed'
                                 ELSE 'in_progress'
                               END,
                completed_at = CASE
                                 WHEN LEAST(progress + $1, target_count) >= target_count
                                  AND completed_at IS NULL
                                 THEN NOW()
                                 ELSE completed_at
                               END
          WHERE id = $2 AND status = 'in_progress'`,
        [increment, row.id]
      );
    }
  } catch (err) {
    console.error('[Quest] incrementQuestProgress failed silently:', err.message);
  }
}

// ── Daily completion bonus ─────────────────────────────────────────────────────
// Called after every daily quest claim. Awards once per period per player.
// Bonus: 8 coins + 3 of a random rare resource (egg / wool / milk).

async function maybeAwardDailyBonus(playerId, periodKey) {
  if (!periodKey || !periodKey.startsWith('daily:')) return { awarded: false };

  try {
    const rows = await query(
      `SELECT status, bonus_claimed FROM player_quests
        WHERE player_id = $1 AND period_key = $2`,
      [playerId, periodKey]
    );

    // Need exactly 4 quests, all claimed, none with bonus already given
    if (rows.length !== 4) return { awarded: false };
    const allClaimed   = rows.every(r => r.status === 'claimed');
    const alreadyGiven = rows.some(r => r.bonus_claimed);
    if (!allClaimed || alreadyGiven) return { awarded: false };

    const bonusCoins    = 8;
    const rareResources = ['egg', 'wool', 'milk'];
    const bonusResource = rareResources[Math.floor(Math.random() * rareResources.length)];
    const bonusAmount   = 3;

    await query('UPDATE players SET coins = coins + $1 WHERE id = $2', [bonusCoins, playerId]);
    await query(
      `UPDATE player_resources
          SET ${bonusResource} = LEAST(${bonusResource} + $1, ${bonusResource}_cap)
        WHERE player_id = $2`,
      [bonusAmount, playerId]
    );
    // Mark bonus claimed on one row (sufficient for dedup check above)
    await query(
      `UPDATE player_quests SET bonus_claimed = TRUE
        WHERE id = (
          SELECT id FROM player_quests
          WHERE player_id = $1 AND period_key = $2
          LIMIT 1
        )`,
      [playerId, periodKey]
    );

    return { awarded: true, coins: bonusCoins, resource: bonusResource, amount: bonusAmount };
  } catch (err) {
    console.error('[Quest] maybeAwardDailyBonus failed:', err.message);
    return { awarded: false };
  }
}

module.exports = {
  getPeriodKey,
  ensureQuestsAssigned,
  incrementQuestProgress,
  maybeAwardDailyBonus,
};
