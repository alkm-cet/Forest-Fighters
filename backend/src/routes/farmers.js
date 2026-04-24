const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { incrementQuestProgress } = require('../quests');

const FARMER_MAX_LEVEL = 50;

// Rate-based linear interpolation: interval = 60 / rate(level)
// This gives large improvements early and smaller (but non-zero) improvements late.
// At L1: strawberry=8min, pinecone=12min, blueberry=16min
// At L50: strawberry=1min, pinecone=2min,  blueberry=3min
function getIntervalByType(resourceType, level = 1) {
  const L = Math.max(1, Math.min(FARMER_MAX_LEVEL, level));
  let rate;
  if (resourceType === 'strawberry') {
    // baseRate=7.5/hr (8min), maxRate=60/hr (1min)
    rate = 7.5 + 52.5 * (L - 1) / 49;
  } else if (resourceType === 'pinecone') {
    // baseRate=5/hr (12min), maxRate=30/hr (2min)
    rate = 5 + 25 * (L - 1) / 49;
  } else if (resourceType === 'blueberry') {
    // baseRate=3.75/hr (16min), maxRate=20/hr (3min)
    rate = 3.75 + 16.25 * (L - 1) / 49;
  } else {
    rate = 6 + 24 * (L - 1) / 49;
  }
  return 60 / rate;
}

// Cross-resource upgrade costs: resource_type → [costRes1, costRes2]
const UPGRADE_RESOURCES = {
  strawberry: ['strawberry', 'pinecone'],
  pinecone:   ['pinecone',   'blueberry'],
  blueberry:  ['blueberry',  'strawberry'],
};

// Upgrade cost per resource = current_level * 2
function getUpgradeCost(level) {
  return level * 2;
}

function getMaxCapacity(level) {
  return 4 + level; // LV1=5, LV2=6, LV3=7, LV4=8, ...
}

function calcPending(lastCollectedAt, level, resourceType) {
  const intervalMs = getIntervalByType(resourceType, level) * 60 * 1000;
  const elapsed = Date.now() - new Date(lastCollectedAt).getTime();
  return Math.min(Math.floor(elapsed / intervalMs), getMaxCapacity(level));
}

// GET /api/farmers — list farmers with pending resources
router.get('/', authMiddleware, async (req, res) => {
  try {
    let rows = await query(
      'SELECT id, name, resource_type, level, last_collected_at FROM farmers WHERE player_id = $1 ORDER BY resource_type ASC',
      [req.player.id]
    );

    if (rows.length === 0) {
      const starters = [
        ['Strawberry Farmer', 'strawberry'],
        ['Pinecone Farmer',   'pinecone'],
        ['Blueberry Farmer',  'blueberry'],
      ];
      for (const [name, type] of starters) {
        await query(
          `INSERT INTO farmers (player_id, name, resource_type, last_collected_at)
           VALUES ($1, $2, $3, NOW() - INTERVAL '24 hours')`,
          [req.player.id, name, type]
        );
      }
      rows = await query(
        'SELECT id, name, resource_type, level, last_collected_at FROM farmers WHERE player_id = $1 ORDER BY resource_type ASC',
        [req.player.id]
      );
    }

    // Fetch active production boosts for all farmers in one query
    const farmerIds = rows.map(f => f.id);
    let boostMap = {};
    if (farmerIds.length) {
      const boostRows = await query(
        `SELECT entity_id, SUM(boost_value) AS total_pct
           FROM active_boosts
          WHERE player_id = $1
            AND entity_id = ANY($2::uuid[])
            AND target IN ('farmers', 'farm_animals')
            AND boost_type = 'boost_production'
            AND expires_at > NOW()
          GROUP BY entity_id`,
        [req.player.id, farmerIds]
      );
      boostRows.forEach(b => { boostMap[b.entity_id] = Number(b.total_pct); });
    }

    const result = rows.map(f => {
      const boostPct = boostMap[f.id] ?? 0;
      const baseInterval = getIntervalByType(f.resource_type, f.level);
      // Boost reduces the interval (faster production)
      const effectiveInterval = boostPct > 0
        ? baseInterval * (1 - boostPct / 100)
        : baseInterval;
      const intervalMs = effectiveInterval * 60 * 1000;
      const elapsed = Date.now() - new Date(f.last_collected_at).getTime();
      const partialMs = elapsed % intervalMs;
      const nextReadyInSeconds = Math.ceil((intervalMs - partialMs) / 1000);
      const pending = Math.min(Math.floor(elapsed / intervalMs), getMaxCapacity(f.level));
      return {
        ...f,
        interval_minutes: effectiveInterval,
        pending,
        next_ready_in_seconds: nextReadyInSeconds,
        active_boost_pct: boostPct,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch farmers' });
  }
});

// POST /api/farmers/:id/collect — collect pending resources
router.post('/:id/collect', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const farmerId = req.params.id;

  try {
    const rows = await query(
      'SELECT id, resource_type, level, last_collected_at FROM farmers WHERE id = $1 AND player_id = $2',
      [farmerId, playerId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    const farmer = rows[0];

    // Get active production boost for this specific farmer
    const boostRows = await query(
      `SELECT COALESCE(SUM(boost_value), 0) AS total_pct
         FROM active_boosts
        WHERE player_id = $1 AND entity_id = $2
          AND target IN ('farmers', 'farm_animals')
          AND boost_type = 'boost_production'
          AND expires_at > NOW()`,
      [playerId, farmerId]
    );
    const boostPct = Number(boostRows[0]?.total_pct ?? 0);
    const baseInterval = getIntervalByType(farmer.resource_type, farmer.level);
    const effectiveInterval = boostPct > 0 ? baseInterval * (1 - boostPct / 100) : baseInterval;
    const intervalMs = effectiveInterval * 60 * 1000;
    const elapsed = Date.now() - new Date(farmer.last_collected_at).getTime();
    const pending = Math.min(Math.floor(elapsed / intervalMs), getMaxCapacity(farmer.level));

    if (pending === 0) return res.status(400).json({ error: 'Nothing to collect yet' });

    // Check how much free space the player has for this resource
    const capCol = `${farmer.resource_type}_cap`;
    const resRows = await query(
      `SELECT ${farmer.resource_type}, ${capCol} FROM player_resources WHERE player_id = $1`,
      [playerId]
    );
    const currentAmount = resRows[0]?.[farmer.resource_type] ?? 0;
    const cap = resRows[0]?.[capCol] ?? 15;
    const freeSpace = Math.max(0, cap - currentAmount);

    if (freeSpace === 0) return res.status(400).json({ error: 'Capacity full' });

    // Only collect as many items as there is space for
    const collectible = Math.min(pending, freeSpace);

    const partialMs = elapsed % intervalMs;
    // Roll back last_collected_at so uncollected items (pending - collectible) remain pending
    const newLastCollected = new Date(Date.now() - partialMs - (pending - collectible) * intervalMs);

    await query(
      `UPDATE player_resources SET ${farmer.resource_type} = ${farmer.resource_type} + $1 WHERE player_id = $2`,
      [collectible, playerId]
    );
    // Fill pvp_storage (loot pool) when resources are earned, capped at 500
    const storageCol = `pvp_storage_${farmer.resource_type}`;
    await query(
      `UPDATE players SET ${storageCol} = LEAST(${storageCol} + $1, 500) WHERE id = $2`,
      [collectible, playerId]
    );
    await query(
      'UPDATE farmers SET last_collected_at = $1 WHERE id = $2',
      [newLastCollected, farmerId]
    );

    // Quest progress — variable increment by actual collected amount
    await incrementQuestProgress(playerId, 'farmer_collect', {
      resourceType: farmer.resource_type,
      amount: collectible,
    });

    const updatedRes = await query(
      'SELECT strawberry, pinecone, blueberry, strawberry_cap, pinecone_cap, blueberry_cap, egg, wool, milk, egg_cap, wool_cap, milk_cap FROM player_resources WHERE player_id = $1',
      [playerId]
    );
    const r = updatedRes[0];
    res.json({
      collected: collectible,
      resource_type: farmer.resource_type,
      resources: {
        ...r,
        strawberry_cap: r.strawberry_cap ?? 10,
        pinecone_cap:   r.pinecone_cap   ?? 10,
        blueberry_cap:  r.blueberry_cap  ?? 10,
        egg:      r.egg      ?? 0,
        wool:     r.wool     ?? 0,
        milk:     r.milk     ?? 0,
        egg_cap:  r.egg_cap  ?? 10,
        wool_cap: r.wool_cap ?? 10,
        milk_cap: r.milk_cap ?? 10,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Collect failed' });
  }
});

// POST /api/farmers/:id/upgrade — upgrade farmer level (cross-resource cost)
router.post('/:id/upgrade', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const farmerId = req.params.id;

  try {
    const rows = await query(
      'SELECT id, resource_type, level FROM farmers WHERE id = $1 AND player_id = $2',
      [farmerId, playerId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    const farmer = rows[0];
    if (farmer.level >= FARMER_MAX_LEVEL) {
      return res.status(400).json({ error: 'Max level reached' });
    }

    const [res1, res2] = UPGRADE_RESOURCES[farmer.resource_type];
    const cost = getUpgradeCost(farmer.level);

    const resRows = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);
    const playerRes = resRows[0];

    if ((playerRes[res1] ?? 0) < cost || (playerRes[res2] ?? 0) < cost) {
      return res.status(400).json({
        error: `Not enough resources (need ${cost} ${res1} + ${cost} ${res2})`,
        cost, res1, res2,
      });
    }

    await query(
      `UPDATE player_resources SET ${res1} = ${res1} - $1, ${res2} = ${res2} - $2 WHERE player_id = $3`,
      [cost, cost, playerId]
    );
    await query('UPDATE farmers SET level = level + 1 WHERE id = $1', [farmerId]);

    // Quest progress — upgrade action
    await incrementQuestProgress(playerId, 'any_upgrade');

    const updatedRes = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);
    const updatedFarmer = await query(
      'SELECT id, name, resource_type, level, last_collected_at FROM farmers WHERE id = $1',
      [farmerId]
    );
    const f = updatedFarmer[0];
    const intervalMinutes = getIntervalByType(f.resource_type, f.level);
    const intervalMs = intervalMinutes * 60 * 1000;
    const elapsed = Date.now() - new Date(f.last_collected_at).getTime();
    const partialMs = elapsed % intervalMs;
    const nextReadyInSeconds = Math.ceil((intervalMs - partialMs) / 1000);
    res.json({
      farmer: { ...f, interval_minutes: intervalMinutes, pending: calcPending(f.last_collected_at, f.level, f.resource_type), next_ready_in_seconds: nextReadyInSeconds },
      resources: updatedRes[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

module.exports = router;
