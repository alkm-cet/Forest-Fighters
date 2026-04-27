const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { getPeriodKey, ensureQuestsAssigned, maybeAwardDailyBonus } = require('../quests');
const { DAILY_QUEST_COUNT, DAILY_BONUS_COINS, DAILY_BONUS_AMOUNT, DAILY_BONUS_RESOURCES } = require('../data/config/quest');

// ─── GET /api/quests ──────────────────────────────────────────────────────────
// Lazy-assigns quests for the current daily/weekly period if not yet done.
// Returns all quests for both periods + daily bonus status.

router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;

  try {
    await ensureQuestsAssigned(playerId, 'daily');
    await ensureQuestsAssigned(playerId, 'weekly');

    const dailyKey  = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');

    const rows = await query(
      `SELECT pq.id,
              pq.definition_id,
              pq.quest_type,
              pq.period_key,
              pq.progress,
              pq.target_count,
              pq.reward_coins,
              pq.metadata,
              pq.status,
              pq.bonus_claimed,
              pq.assigned_at,
              pq.completed_at,
              pq.claimed_at,
              qd.title,
              qd.description,
              qd.category,
              qd.difficulty,
              qd.action_key
         FROM player_quests pq
         JOIN quest_definitions qd ON qd.id = pq.definition_id
        WHERE pq.player_id = $1
          AND pq.period_key IN ($2, $3)
        ORDER BY pq.assigned_at ASC`,
      [playerId, dailyKey, weeklyKey]
    );

    const daily  = rows.filter(r => r.period_key === dailyKey);
    const weekly = rows.filter(r => r.period_key === weeklyKey);

    // Daily bonus status
    const claimedCount  = daily.filter(r => r.status === 'claimed').length;
    const alreadyClaimed = daily.some(r => r.bonus_claimed);

    return res.json({
      daily,
      weekly,
      dailyBonus: {
        claimed_count:   claimedCount,
        total:           DAILY_QUEST_COUNT,
        bonus_coins:     DAILY_BONUS_COINS,
        bonus_resource:  DAILY_BONUS_RESOURCES.join('/') + ' (random)',
        bonus_amount:    DAILY_BONUS_AMOUNT,
        already_claimed: alreadyClaimed,
      },
    });
  } catch (err) {
    console.error('[GET /api/quests]', err);
    return res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// ─── POST /api/quests/:id/claim ───────────────────────────────────────────────
// Claims a completed quest and awards coins.
// Awards daily completion bonus if all 4 daily quests are now claimed.

router.post('/:id/claim', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const questId  = req.params.id;

  try {
    // Verify ownership and completeness
    const rows = await query(
      `SELECT id, player_id, status, quest_type, period_key, reward_coins
         FROM player_quests WHERE id = $1`,
      [questId]
    );

    if (rows.length === 0 || rows[0].player_id !== playerId) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const pq = rows[0];

    if (pq.status === 'claimed') {
      return res.status(400).json({ error: 'Quest already claimed' });
    }
    if (pq.status !== 'completed') {
      return res.status(400).json({ error: 'Quest not completed yet' });
    }

    // Claim and award coins atomically
    // AND status = 'completed' guard ensures idempotency under race conditions
    const updated = await query(
      `UPDATE player_quests
          SET status = 'claimed', claimed_at = NOW()
        WHERE id = $1 AND status = 'completed'
        RETURNING id`,
      [questId]
    );

    if (updated.length === 0) {
      return res.status(400).json({ error: 'Quest already claimed' });
    }

    await query(
      'UPDATE players SET coins = coins + $1 WHERE id = $2',
      [pq.reward_coins, playerId]
    );

    const [playerRow] = await query('SELECT coins FROM players WHERE id = $1', [playerId]);
    const newCoinTotal = playerRow.coins;

    // Daily completion bonus check
    let bonus = { awarded: false };
    if (pq.quest_type === 'daily') {
      bonus = await maybeAwardDailyBonus(playerId, pq.period_key);
    }

    return res.json({
      success:        true,
      coins_awarded:  pq.reward_coins,
      new_coin_total: newCoinTotal,
      bonus,
    });
  } catch (err) {
    console.error('[POST /api/quests/:id/claim]', err);
    return res.status(500).json({ error: 'Failed to claim quest' });
  }
});

module.exports = router;
