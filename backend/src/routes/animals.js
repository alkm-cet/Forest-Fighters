const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { incrementQuestProgress } = require('../quests');
const {
  ANIMAL_MAX_LEVEL, MINUTES_PER_FEED, ANIMAL_CONFIGS,
  UPGRADE_RESOURCES, STORAGE_UPGRADE_COST, ANIMAL_CAP_MAX, ANIMAL_CAP_STEP, INITIAL_FUEL,
  getProduceInterval, getMaxCapacity, getMaxFeed, getMaxFuelMinutes, getUpgradeCost,
} = require('../data/config/animal');

const SELECT_COLS = 'id, animal_type, level, fuel_remaining_minutes, progress_minutes, pending_production, last_computed_ms';

// Pure function — advances animal state from last_computed_ms to nowMs.
// last_computed_ms is a plain Unix millisecond integer — no timezone parsing needed.
function computeState(animal, nowMs) {
  const level           = animal.level;
  const produceInterval = getProduceInterval(animal.animal_type, level);

  const _parsed = parseInt(animal.last_computed_ms);
  const lastComputedMs  = _parsed > 0 ? _parsed : nowMs;
  const elapsedMin      = Math.max(0, (nowMs - lastComputedMs) / 60000);

  const fuelRemaining   = parseFloat(animal.fuel_remaining_minutes) || 0;
  const progressMin     = parseFloat(animal.progress_minutes)       || 0;
  const existingPending = parseInt(animal.pending_production)       || 0;
  const maxCap          = getMaxCapacity(level);

  // Animal can only run while it has fuel AND production storage has space
  const canRun       = fuelRemaining > 0 && existingPending < maxCap;
  const actualRunMin = canRun ? Math.min(elapsedMin, fuelRemaining) : 0;
  const newFuel      = fuelRemaining - actualRunMin;

  const totalProgress = progressMin + actualRunMin;
  const newCycles     = Math.floor(totalProgress / produceInterval);
  const newProgress   = totalProgress % produceInterval;
  const newPending    = Math.min(existingPending + newCycles, maxCap);
  const isRunning     = newFuel > 0 && newPending < maxCap;

  // Seconds until next production (only meaningful if running)
  const remainingInCycleMin = produceInterval - newProgress;
  const nextReadyInSeconds  = isRunning ? Math.ceil(remainingInCycleMin * 60) : null;

  return {
    fuel_remaining_minutes: newFuel,
    progress_minutes:       newProgress,
    pending_production:     newPending,
    is_running:             isRunning,
    next_ready_in_seconds:  nextReadyInSeconds,
  };
}

// Commit computed state to DB
async function commitState(animalId, state, nowMs) {
  await query(
    `UPDATE player_animals
        SET fuel_remaining_minutes = $1,
            progress_minutes       = $2,
            pending_production     = $3,
            last_computed_ms       = $4
      WHERE id = $5`,
    [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production, nowMs, animalId]
  );
}

function buildAnimalResponse(a, nowMs = null) {
  const now            = nowMs ?? Date.now();
  const cfg            = ANIMAL_CONFIGS[a.animal_type];
  const level          = a.level;
  const state          = computeState(a, now);
  const minutesPerFeed = MINUTES_PER_FEED[a.animal_type];
  const maxFeedUnits   = getMaxFeed(level);
  const maxFuelMinutes = getMaxFuelMinutes(a.animal_type, level);
  const intervalMinutes = getProduceInterval(a.animal_type, level);

  return {
    id:          a.id,
    animal_type: a.animal_type,
    level,
    current_feed:           Math.floor(state.fuel_remaining_minutes / minutesPerFeed),
    max_feed:               maxFeedUnits,
    fuel_remaining_minutes: state.fuel_remaining_minutes,
    max_fuel_minutes:       maxFuelMinutes,
    progress_minutes:       state.progress_minutes,
    pending:                state.pending_production,
    next_ready_in_seconds:  state.next_ready_in_seconds,
    interval_minutes:       intervalMinutes,
    minutes_per_feed:       minutesPerFeed,
    max_capacity:           getMaxCapacity(level),
    is_running:             state.is_running,
    consume_resource:       cfg.consumeResource,
    produce_resource:       cfg.produceResource,
  };
}

// ─── GET /api/animals ─────────────────────────────────────────────────────────
// List all animals; auto-create chicken/sheep/cow on first call
router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    let rows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE player_id = $1 ORDER BY animal_type ASC`,
      [playerId]
    );
    if (rows.length === 0) {
      const nowMs = Date.now();
      // Start animals fully fed (max_feed = 10 at level 1) and with max pending production
      const INITIAL_PENDING = getMaxCapacity(1);
      for (const animalType of ['chicken', 'cow', 'sheep']) {
        await query(
          `INSERT INTO player_animals (player_id, animal_type, last_computed_ms, fuel_remaining_minutes, pending_production)
           VALUES ($1, $2, $3, $4, $5)`,
          [playerId, animalType, nowMs, INITIAL_FUEL[animalType], INITIAL_PENDING]
        );
      }
      rows = await query(
        `SELECT ${SELECT_COLS} FROM player_animals WHERE player_id = $1 ORDER BY animal_type ASC`,
        [playerId]
      );
    }

    // Compute state for every animal and commit it back to DB in parallel.
    // This ensures last_computed_ms is always fresh, so any subsequent GET
    // (e.g. after shake+reload) correctly advances the timer from where it left off.
    const nowMs = Date.now();
    const states = rows.map(a => ({ animal: a, state: computeState(a, nowMs) }));
    await Promise.all(
      states.map(({ animal, state }) => commitState(animal.id, state, nowMs))
    );

    // Build responses from the already-computed states — no re-fetch needed.
    return res.json(states.map(({ animal, state }) => {
      const cfg            = ANIMAL_CONFIGS[animal.animal_type];
      const level          = animal.level;
      const minutesPerFeed = MINUTES_PER_FEED[animal.animal_type];
      const maxFeedUnits   = getMaxFeed(level);
      const maxFuelMinutes = getMaxFuelMinutes(animal.animal_type, level);
      const intervalMinutes = getProduceInterval(animal.animal_type, level);
      return {
        id:                     animal.id,
        animal_type:            animal.animal_type,
        level,
        current_feed:           Math.floor(state.fuel_remaining_minutes / minutesPerFeed),
        max_feed:               maxFeedUnits,
        fuel_remaining_minutes: state.fuel_remaining_minutes,
        max_fuel_minutes:       maxFuelMinutes,
        progress_minutes:       state.progress_minutes,
        pending:                state.pending_production,
        next_ready_in_seconds:  state.next_ready_in_seconds,
        interval_minutes:       intervalMinutes,
        minutes_per_feed:       minutesPerFeed,
        max_capacity:           getMaxCapacity(level),
        is_running:             state.is_running,
        consume_resource:       cfg.consumeResource,
        produce_resource:       cfg.produceResource,
      };
    }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch animals' });
  }
});

// ─── POST /api/animals/:id/feed ────────────────────────────────────────────────
// Feed +1 unit: consumes 1 resource, adds MINUTES_PER_FEED minutes of fuel.
// Does NOT reset progress — only adds fuel time.
router.post('/:id/feed', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const animalId = req.params.id;
  try {
    const rows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1 AND player_id = $2`,
      [animalId, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Animal not found' });

    const animal         = rows[0];
    const cfg            = ANIMAL_CONFIGS[animal.animal_type];
    const minutesPerFeed = MINUTES_PER_FEED[animal.animal_type];
    const nowMs          = Date.now();
    const state          = computeState(animal, nowMs);
    const maxFuelMinutes = getMaxFuelMinutes(animal.animal_type, animal.level);

    if (state.fuel_remaining_minutes + minutesPerFeed > maxFuelMinutes + 0.01) {
      return res.status(400).json({ error: 'Feed storage full' });
    }

    const resRows = await query(
      `SELECT ${cfg.consumeResource} FROM player_resources WHERE player_id = $1`,
      [playerId]
    );
    if ((resRows[0]?.[cfg.consumeResource] ?? 0) < 1) {
      return res.status(400).json({ error: `Not enough ${cfg.consumeResource}` });
    }

    await query(
      `UPDATE player_resources SET ${cfg.consumeResource} = GREATEST(${cfg.consumeResource} - 1, 0) WHERE player_id = $1`,
      [playerId]
    );

    await query(
      `UPDATE player_animals
          SET fuel_remaining_minutes = $1,
              progress_minutes       = $2,
              pending_production     = $3,
              last_computed_ms       = $4
        WHERE id = $5`,
      [state.fuel_remaining_minutes + minutesPerFeed, state.progress_minutes, state.pending_production, nowMs, animalId]
    );

    // Quest progress — single feed action
    await incrementQuestProgress(playerId, 'animal_feed', { animalType: animal.animal_type });

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({ animal: buildAnimalResponse(updated, nowMs), resources: updatedRes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Feed failed' });
  }
});

// ─── POST /api/animals/:id/feed-max ───────────────────────────────────────────
// Fill feed storage to capacity in one call.
router.post('/:id/feed-max', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const animalId = req.params.id;
  try {
    const rows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1 AND player_id = $2`,
      [animalId, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Animal not found' });

    const animal         = rows[0];
    const cfg            = ANIMAL_CONFIGS[animal.animal_type];
    const minutesPerFeed = MINUTES_PER_FEED[animal.animal_type];
    const nowMs          = Date.now();
    const state          = computeState(animal, nowMs);
    const maxFuelMinutes = getMaxFuelMinutes(animal.animal_type, animal.level);

    const fuelNeeded  = maxFuelMinutes - state.fuel_remaining_minutes;
    const unitsNeeded = Math.ceil(fuelNeeded / minutesPerFeed);

    if (unitsNeeded <= 0) return res.status(400).json({ error: 'Feed storage already full' });

    const resRows = await query(
      `SELECT ${cfg.consumeResource} FROM player_resources WHERE player_id = $1`,
      [playerId]
    );
    const available = resRows[0]?.[cfg.consumeResource] ?? 0;
    if (available <= 0) {
      return res.status(400).json({ error: `No ${cfg.consumeResource} available` });
    }

    // requestedUnits is what the frontend UI showed the player they would spend.
    // Cap at that value so stale server-side fuel state never charges more than the player agreed to.
    const requestedUnits = parseInt(req.body?.requestedUnits) || unitsNeeded;
    const actualUnits    = Math.min(unitsNeeded, requestedUnits, available);
    const newFuelMinutes = Math.min(
      state.fuel_remaining_minutes + actualUnits * minutesPerFeed,
      maxFuelMinutes
    );

    await query(
      `UPDATE player_resources SET ${cfg.consumeResource} = GREATEST(${cfg.consumeResource} - $1, 0) WHERE player_id = $2`,
      [actualUnits, playerId]
    );

    await query(
      `UPDATE player_animals
          SET fuel_remaining_minutes = $1,
              progress_minutes       = $2,
              pending_production     = $3,
              last_computed_ms       = $4
        WHERE id = $5`,
      [newFuelMinutes, state.progress_minutes, state.pending_production, nowMs, animalId]
    );

    // Quest progress — counts as 1 feed action regardless of units filled
    await incrementQuestProgress(playerId, 'animal_feed', { animalType: animal.animal_type });

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({ animal: buildAnimalResponse(updated, nowMs), resources: updatedRes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Feed-max failed' });
  }
});

// ─── POST /api/animals/:id/collect ────────────────────────────────────────────
// Collect pending produce into player resource storage.
router.post('/:id/collect', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const animalId = req.params.id;
  try {
    const rows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1 AND player_id = $2`,
      [animalId, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Animal not found' });

    const animal = rows[0];
    const cfg    = ANIMAL_CONFIGS[animal.animal_type];
    const nowMs  = Date.now();
    const state  = computeState(animal, nowMs);

    if (state.pending_production === 0) {
      return res.status(400).json({ error: 'Nothing to collect yet' });
    }

    const capCol  = `${cfg.produceResource}_cap`;
    const resRows = await query(
      `SELECT ${cfg.produceResource}, ${capCol} FROM player_resources WHERE player_id = $1`,
      [playerId]
    );
    const currentAmount = resRows[0]?.[cfg.produceResource] ?? 0;
    const cap           = resRows[0]?.[capCol]              ?? 10;
    const freeSpace     = Math.max(0, cap - currentAmount);

    if (freeSpace === 0) return res.status(400).json({ error: 'Storage full' });

    const collectible = Math.min(state.pending_production, freeSpace);

    await query(
      `UPDATE player_animals
          SET fuel_remaining_minutes = $1,
              progress_minutes       = $2,
              pending_production     = $3,
              last_computed_ms       = $4
        WHERE id = $5`,
      [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production - collectible, nowMs, animalId]
    );
    await query(
      `UPDATE player_resources
          SET ${cfg.produceResource} = LEAST(${cfg.produceResource} + $1, ${capCol})
        WHERE player_id = $2`,
      [collectible, playerId]
    );

    // Quest progress — variable increment by actual collected amount
    await incrementQuestProgress(playerId, 'animal_collect', {
      resourceType: cfg.produceResource,
      animalType:   animal.animal_type,
      amount:       collectible,
    });

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({
      collected:        collectible,
      produce_resource: cfg.produceResource,
      animal:           buildAnimalResponse(updated, nowMs),
      resources:        updatedRes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Collect failed' });
  }
});

// ─── POST /api/animals/:id/upgrade ────────────────────────────────────────────
// Level up an animal (increases speed, feed capacity, production capacity).
router.post('/:id/upgrade', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const animalId = req.params.id;
  try {
    const rows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1 AND player_id = $2`,
      [animalId, playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Animal not found' });

    const animal = rows[0];
    if (animal.level >= ANIMAL_MAX_LEVEL) {
      return res.status(400).json({ error: 'Max level reached' });
    }

    const [res1, res2] = UPGRADE_RESOURCES[animal.animal_type];
    const cost = getUpgradeCost(animal.level);

    const [playerRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);
    if ((playerRes[res1] ?? 0) < cost || (playerRes[res2] ?? 0) < cost) {
      return res.status(400).json({
        error: `Not enough resources (need ${cost} ${res1} + ${cost} ${res2})`,
        cost, res1, res2,
      });
    }

    // Commit current state before level-up (level change alters interval/capacity)
    const nowMs = Date.now();
    const state = computeState(animal, nowMs);
    await commitState(animalId, state, nowMs);

    await query(
      `UPDATE player_resources SET ${res1} = ${res1} - $1, ${res2} = ${res2} - $2 WHERE player_id = $3`,
      [cost, cost, playerId]
    );
    await query('UPDATE player_animals SET level = level + 1 WHERE id = $1', [animalId]);

    // Quest progress — upgrade action
    await incrementQuestProgress(playerId, 'any_upgrade');

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({ animal: buildAnimalResponse(updated, nowMs), resources: updatedRes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upgrade failed' });
  }
});

// ─── POST /api/animals/upgrade-storage ────────────────────────────────────────
// Upgrade egg/wool/milk player resource cap.
router.post('/upgrade-storage', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { resource } = req.body;

  if (!['egg', 'wool', 'milk'].includes(resource)) {
    return res.status(400).json({ error: 'Invalid resource' });
  }

  const upgCost = STORAGE_UPGRADE_COST[resource];
  const capCol  = `${resource}_cap`;

  try {
    const [playerRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);
    if (!playerRes) return res.status(404).json({ error: 'Resources not found' });

    const currentCap = playerRes[capCol] ?? 10;
    if (currentCap >= ANIMAL_CAP_MAX) {
      return res.status(400).json({ error: 'Maximum storage capacity reached' });
    }
    if ((playerRes[upgCost.res1] ?? 0) < upgCost.cost1) {
      return res.status(400).json({ error: `Not enough ${upgCost.res1} (need ${upgCost.cost1})` });
    }
    if ((playerRes[upgCost.res2] ?? 0) < upgCost.cost2) {
      return res.status(400).json({ error: `Not enough ${upgCost.res2} (need ${upgCost.cost2})` });
    }

    await query(
      `UPDATE player_resources
         SET ${capCol}       = LEAST(${capCol} + ${ANIMAL_CAP_STEP}, ${ANIMAL_CAP_MAX}),
             ${upgCost.res1} = ${upgCost.res1} - $1,
             ${upgCost.res2} = ${upgCost.res2} - $2
       WHERE player_id = $3`,
      [upgCost.cost1, upgCost.cost2, playerId]
    );

    const [updated] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Storage upgrade failed' });
  }
});

module.exports = router;
