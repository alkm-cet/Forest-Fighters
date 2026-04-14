const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const COIN_REVIVE_COST = 15;
const MAX_COINS = 999999;

// Helper: get current coin balance
async function getCoins(playerId) {
  const rows = await query('SELECT coins FROM players WHERE id = $1', [playerId]);
  return rows[0]?.coins ?? 0;
}

// GET /api/coins — current coin balance
router.get('/', authMiddleware, async (req, res) => {
  try {
    const coins = await getCoins(req.player.id);
    return res.json({ coins });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch coins' });
  }
});

// POST /api/coins/fill-farmer-storage — spend coins to fill farmer pending to max capacity
// Cost: missingItems = maxCap - currentPending (min 1)
router.post('/fill-farmer-storage', authMiddleware, async (req, res) => {
  const { farmer_id } = req.body;
  if (!farmer_id) return res.status(400).json({ error: 'farmer_id required' });

  const playerId = req.player.id;

  try {
    const rows = await query(
      'SELECT id, name, resource_type, level, last_collected_at FROM farmers WHERE id = $1 AND player_id = $2',
      [farmer_id, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Farmer not found' });

    const farmer = rows[0];

    // Reproduce the same interval formula as farmers.js
    const level = Math.max(1, Math.min(50, farmer.level));
    let rate;
    if (farmer.resource_type === 'strawberry') {
      rate = 7.5 + 52.5 * (level - 1) / 49;
    } else if (farmer.resource_type === 'pinecone') {
      rate = 5 + 25 * (level - 1) / 49;
    } else if (farmer.resource_type === 'blueberry') {
      rate = 3.75 + 16.25 * (level - 1) / 49;
    } else {
      rate = 6 + 24 * (level - 1) / 49;
    }
    const intervalMs = (60 / rate) * 60 * 1000;

    const maxCap = 4 + farmer.level;
    const elapsed = Date.now() - new Date(farmer.last_collected_at).getTime();
    const currentPending = Math.min(Math.floor(elapsed / intervalMs), maxCap);
    const missing = maxCap - currentPending;

    if (missing <= 0) {
      return res.status(400).json({ error: 'Storage already full' });
    }

    const cost = missing;
    const currentCoins = await getCoins(playerId);

    if (currentCoins < cost) {
      return res.status(400).json({ error: 'Not enough coins', cost, coins: currentCoins });
    }

    // Set last_collected_at far enough back that pending == maxCap
    // Use maxCap+1 intervals to avoid floating point boundary issues (capped by min anyway)
    const newLastCollected = new Date(Date.now() - (maxCap + 1) * intervalMs);

    await query(
      'UPDATE players SET coins = coins - $1 WHERE id = $2',
      [cost, playerId]
    );
    await query(
      'UPDATE farmers SET last_collected_at = $1 WHERE id = $2',
      [newLastCollected, farmer_id]
    );

    const updatedFarmer = await query(
      'SELECT id, name, resource_type, level, last_collected_at FROM farmers WHERE id = $1',
      [farmer_id]
    );
    const newCoins = await getCoins(playerId);

    const f = updatedFarmer[0];
    const elapsedAfter = Date.now() - new Date(f.last_collected_at).getTime();
    const partialMsAfter = elapsedAfter % intervalMs;
    const nextReadyInSeconds = Math.ceil((intervalMs - partialMsAfter) / 1000);
    const pending = Math.min(Math.floor(elapsedAfter / intervalMs), maxCap);

    return res.json({
      coins: newCoins,
      farmer: {
        ...f,
        interval_minutes: intervalMs / 60000,
        pending,
        next_ready_in_seconds: nextReadyInSeconds,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fill farmer storage' });
  }
});

// POST /api/coins/skip-dungeon — spend coins to complete a dungeon run immediately
// Cost: max(1, ceil(secondsRemaining / 60)) — 1 coin per minute remaining, min 1
router.post('/skip-dungeon', authMiddleware, async (req, res) => {
  const { run_id } = req.body;
  if (!run_id) return res.status(400).json({ error: 'run_id required' });

  const playerId = req.player.id;

  try {
    const rows = await query(
      'SELECT id, ends_at, status FROM dungeon_runs WHERE id = $1 AND player_id = $2',
      [run_id, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });

    const run = rows[0];
    if (run.status !== 'active') {
      return res.status(400).json({ error: 'Run is not active' });
    }

    const secondsRemaining = Math.max(0, (new Date(run.ends_at).getTime() - Date.now()) / 1000);
    if (secondsRemaining <= 0) {
      return res.status(400).json({ error: 'Already finished' });
    }

    const cost = Math.max(1, Math.ceil(secondsRemaining / 60));
    const currentCoins = await getCoins(playerId);

    if (currentCoins < cost) {
      return res.status(400).json({ error: 'Not enough coins', cost, coins: currentCoins });
    }

    await query(
      'UPDATE players SET coins = coins - $1 WHERE id = $2',
      [cost, playerId]
    );
    await query(
      "UPDATE dungeon_runs SET ends_at = NOW() WHERE id = $1",
      [run_id]
    );

    const newCoins = await getCoins(playerId);
    return res.json({ coins: newCoins, ends_at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to skip dungeon' });
  }
});

// POST /api/coins/skip-pvp — spend coins to make PvP result available immediately
// Cost: max(1, ceil(secondsRemaining / 60))
router.post('/skip-pvp', authMiddleware, async (req, res) => {
  const { battle_id } = req.body;
  if (!battle_id) return res.status(400).json({ error: 'battle_id required' });

  const playerId = req.player.id;

  try {
    const rows = await query(
      `SELECT id, result_available_at, status FROM pvp_battles
       WHERE id = $1 AND attacker_id = $2 AND status = 'pending'`,
      [battle_id, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Battle not found' });

    const battle = rows[0];
    const secondsRemaining = Math.max(0, (new Date(battle.result_available_at).getTime() - Date.now()) / 1000);
    if (secondsRemaining <= 0) {
      return res.status(400).json({ error: 'Already finished' });
    }

    const cost = Math.max(1, Math.ceil(secondsRemaining / 60));
    const currentCoins = await getCoins(playerId);

    if (currentCoins < cost) {
      return res.status(400).json({ error: 'Not enough coins', cost, coins: currentCoins });
    }

    await query('UPDATE players SET coins = coins - $1 WHERE id = $2', [cost, playerId]);
    await query("UPDATE pvp_battles SET result_available_at = NOW() WHERE id = $1", [battle_id]);

    const newCoins = await getCoins(playerId);
    return res.json({ coins: newCoins, result_available_at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to skip PvP battle' });
  }
});

// POST /api/coins/fill-animal-storage — spend coins to fill animal pending_production to max
// Cost: maxCap - currentPending (min 1)
router.post('/fill-animal-storage', authMiddleware, async (req, res) => {
  const { animal_id } = req.body;
  if (!animal_id) return res.status(400).json({ error: 'animal_id required' });

  const playerId = req.player.id;

  try {
    const rows = await query(
      'SELECT id, animal_type, level, fuel_remaining_minutes, progress_minutes, pending_production, last_computed_ms FROM player_animals WHERE id = $1 AND player_id = $2',
      [animal_id, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Animal not found' });

    const animal = rows[0];
    const level = animal.level;
    const maxCap = 9 + level;
    const nowMs = Date.now();

    // Compute current state to get live pending count
    const lastComputedMs = parseInt(animal.last_computed_ms) || nowMs;
    const elapsedMin = Math.max(0, (nowMs - lastComputedMs) / 60000);
    const fuelRemaining = parseFloat(animal.fuel_remaining_minutes) || 0;
    const progressMin = parseFloat(animal.progress_minutes) || 0;
    const existingPending = parseInt(animal.pending_production) || 0;

    const canRun = fuelRemaining > 0 && existingPending < maxCap;
    const actualRunMin = canRun ? Math.min(elapsedMin, fuelRemaining) : 0;
    const intervalMin = (() => {
      const base = { chicken: 20, sheep: 32, cow: 40 };
      const min  = { chicken:  5, sheep:  8, cow: 10 };
      const b = base[animal.animal_type];
      const m = min[animal.animal_type];
      const L = Math.max(1, Math.min(50, level));
      return b - (b - m) * (L - 1) / 49;
    })();
    const totalProgress = progressMin + actualRunMin;
    const newCycles = intervalMin > 0 ? Math.floor(totalProgress / intervalMin) : 0;
    const currentPending = Math.min(existingPending + newCycles, maxCap);
    const missing = maxCap - currentPending;

    if (missing <= 0) return res.status(400).json({ error: 'Storage already full' });

    const cost = missing;
    const currentCoins = await getCoins(playerId);
    if (currentCoins < cost) {
      return res.status(400).json({ error: 'Not enough coins', cost, coins: currentCoins });
    }

    await query('UPDATE players SET coins = coins - $1 WHERE id = $2', [cost, playerId]);
    // Set pending to maxCap; keep progress at 0 (new cycle starts)
    await query(
      'UPDATE player_animals SET pending_production = $1, progress_minutes = 0, last_computed_ms = $2 WHERE id = $3',
      [maxCap, nowMs, animal_id]
    );

    const updated = await query(
      'SELECT id, animal_type, level, fuel_remaining_minutes, progress_minutes, pending_production, last_computed_ms FROM player_animals WHERE id = $1',
      [animal_id]
    );
    const newCoins = await getCoins(playerId);

    // Build response using the same buildAnimalResponse logic inline
    const a = updated[0];
    const cfg = { chicken: { consumeResource: 'strawberry', produceResource: 'egg' }, sheep: { consumeResource: 'pinecone', produceResource: 'wool' }, cow: { consumeResource: 'blueberry', produceResource: 'milk' } };
    const minutesPerFeed = { chicken: 5, sheep: 8, cow: 10 }[a.animal_type];
    const maxFeedUnits = 9 + a.level;
    const maxFuelMinutes = maxFeedUnits * minutesPerFeed;
    const newIntervalMin = (() => {
      const base = { chicken: 20, sheep: 32, cow: 40 };
      const min  = { chicken:  5, sheep:  8, cow: 10 };
      const b = base[a.animal_type]; const m = min[a.animal_type];
      const L = Math.max(1, Math.min(50, a.level));
      return b - (b - m) * (L - 1) / 49;
    })();
    const newFuelRemaining = parseFloat(a.fuel_remaining_minutes) || 0;
    const isRunning = newFuelRemaining > 0 && maxCap > 0 && parseInt(a.pending_production) < maxCap;
    const nextReadyInSeconds = isRunning ? Math.ceil(newIntervalMin * 60) : null;

    return res.json({
      coins: newCoins,
      animal: {
        id: a.id,
        animal_type: a.animal_type,
        level: a.level,
        current_feed: Math.floor(newFuelRemaining / minutesPerFeed),
        max_feed: maxFeedUnits,
        fuel_remaining_minutes: newFuelRemaining,
        max_fuel_minutes: maxFuelMinutes,
        progress_minutes: 0,
        pending: parseInt(a.pending_production),
        next_ready_in_seconds: nextReadyInSeconds,
        interval_minutes: newIntervalMin,
        minutes_per_feed: minutesPerFeed,
        max_capacity: maxCap,
        is_running: isRunning,
        consume_resource: cfg[a.animal_type].consumeResource,
        produce_resource: cfg[a.animal_type].produceResource,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fill animal storage' });
  }
});

// POST /api/coins/revive-champion — spend 5 coins to instantly revive a dead champion
router.post('/revive-champion', authMiddleware, async (req, res) => {
  const { champion_id } = req.body;
  if (!champion_id) return res.status(400).json({ error: 'champion_id required' });

  const playerId = req.player.id;

  try {
    const rows = await query(
      'SELECT id, current_hp, max_hp FROM champions WHERE id = $1 AND player_id = $2',
      [champion_id, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Champion not found' });

    const champion = rows[0];
    if (champion.current_hp > 0) {
      return res.status(400).json({ error: 'Champion is not dead' });
    }

    const currentCoins = await getCoins(playerId);
    if (currentCoins < COIN_REVIVE_COST) {
      return res.status(400).json({ error: 'Not enough coins', cost: COIN_REVIVE_COST, coins: currentCoins });
    }

    await query(
      'UPDATE players SET coins = coins - $1 WHERE id = $2',
      [COIN_REVIVE_COST, playerId]
    );
    await query(
      'UPDATE champions SET current_hp = max_hp WHERE id = $1',
      [champion_id]
    );

    const updated = await query('SELECT * FROM champions WHERE id = $1', [champion_id]);
    const newCoins = await getCoins(playerId);

    return res.json({ coins: newCoins, champion: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to revive champion with coins' });
  }
});

// POST /api/coins/heal-champion — spend coins to fully heal an injured champion
// Cost: ceil(missingHp / 20) * 4 coins
router.post('/heal-champion', authMiddleware, async (req, res) => {
  const { champion_id } = req.body;
  if (!champion_id) return res.status(400).json({ error: 'champion_id required' });

  const playerId = req.player.id;

  try {
    const rows = await query(
      'SELECT id, current_hp, max_hp, boost_hp FROM champions WHERE id = $1 AND player_id = $2',
      [champion_id, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Champion not found' });

    const champion = rows[0];
    const effectiveMaxHp = champion.max_hp + (champion.boost_hp || 0);
    if (champion.current_hp <= 0) {
      return res.status(400).json({ error: 'Champion is dead, use revive' });
    }
    if (champion.current_hp >= effectiveMaxHp) {
      return res.status(400).json({ error: 'Champion is already at full HP' });
    }

    const missingHp = effectiveMaxHp - champion.current_hp;
    const cost = Math.ceil(missingHp / 20) * 4;

    const currentCoins = await getCoins(playerId);
    if (currentCoins < cost) {
      return res.status(400).json({ error: 'Not enough coins', cost, coins: currentCoins });
    }

    await query('UPDATE players SET coins = coins - $1 WHERE id = $2', [cost, playerId]);
    await query('UPDATE champions SET current_hp = $1 WHERE id = $2', [effectiveMaxHp, champion_id]);

    const updated = await query('SELECT * FROM champions WHERE id = $1', [champion_id]);
    const newCoins = await getCoins(playerId);

    return res.json({ coins: newCoins, champion: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to heal champion with coins' });
  }
});

// POST /api/coins/add — add coins to current player (dev/testing; future IAP webhook)
router.post('/add', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const playerId = req.player.id;

  try {
    await query(
      `UPDATE players SET coins = LEAST(coins + $1, ${MAX_COINS}) WHERE id = $2`,
      [Math.floor(amount), playerId]
    );
    const newCoins = await getCoins(playerId);
    return res.json({ coins: newCoins });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add coins' });
  }
});

module.exports = router;
