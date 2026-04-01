const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const ANIMAL_MAX_LEVEL = 50;

// Each feed unit adds this many minutes of "fuel" to the animal
const MINUTES_PER_FEED = {
  chicken: 5,   // 4 feeds = 20 min = 1 egg
  sheep:   8,   // 4 feeds = 32 min ≈ 1 wool
  cow:     10,  // 4 feeds = 40 min = 1 milk
};

// Production interval (minutes per item) — scales faster with level
// chicken: L1=20min  → L50=5min
// sheep:   L1=32min  → L50=8min
// cow:     L1=40min  → L50=10min
function getProduceInterval(animalType, level) {
  const L = Math.max(1, Math.min(ANIMAL_MAX_LEVEL, level));
  const base = { chicken: 20, sheep: 32, cow: 40 };
  const min  = { chicken:  5, sheep:  8, cow: 10 };
  const b = base[animalType];
  const m = min[animalType];
  return b - (b - m) * (L - 1) / (ANIMAL_MAX_LEVEL - 1);
}

// Max pending capacity
function getMaxCapacity(level) {
  return 4 + level;
}

// max_feed is stored in DB (default 30 feed units)
function getMaxFuelMinutes(animalType, maxFeedUnits) {
  return maxFeedUnits * MINUTES_PER_FEED[animalType];
}

// Upgrade cost
const UPGRADE_RESOURCES = {
  chicken: ['strawberry', 'pinecone'],
  sheep:   ['pinecone',   'blueberry'],
  cow:     ['blueberry',  'strawberry'],
};
function getUpgradeCost(level) { return level * 2; }

// Storage upgrade for produced resources
const STORAGE_UPGRADE_COST = {
  egg:  { res1: 'strawberry', res2: 'pinecone',   cost1: 20, cost2: 10 },
  wool: { res1: 'pinecone',   res2: 'blueberry',  cost1: 20, cost2: 10 },
  milk: { res1: 'blueberry',  res2: 'strawberry', cost1: 20, cost2: 10 },
};
const ANIMAL_CAP_MAX  = 100;
const ANIMAL_CAP_STEP = 10;

const ANIMAL_CONFIGS = {
  chicken: { name: 'Chicken', consumeResource: 'strawberry', produceResource: 'egg'  },
  sheep:   { name: 'Sheep',   consumeResource: 'pinecone',   produceResource: 'wool' },
  cow:     { name: 'Cow',     consumeResource: 'blueberry',  produceResource: 'milk' },
};

const SELECT_COLS = 'id, animal_type, level, max_feed, fuel_remaining_minutes, progress_minutes, pending_production, last_computed_at';

// Pure function — advances animal state from last_computed_at to nowMs
function computeState(animal, nowMs) {
  const level          = animal.level;
  const produceInterval = getProduceInterval(animal.animal_type, level); // minutes
  const lastComputed   = new Date(animal.last_computed_at ?? Date.now()).getTime();
  const elapsedMin     = Math.max(0, (nowMs - lastComputed) / 60000);

  const fuelRemaining  = parseFloat(animal.fuel_remaining_minutes) || 0;
  const progressMin    = parseFloat(animal.progress_minutes)       || 0;
  const existingPending = parseInt(animal.pending_production)      || 0;

  // Animal can only run as long as it has fuel
  const actualRunMin   = Math.min(elapsedMin, fuelRemaining);
  const newFuel        = fuelRemaining - actualRunMin;
  const totalProgress  = progressMin + actualRunMin;
  const newCycles      = Math.floor(totalProgress / produceInterval);
  const newProgress    = totalProgress % produceInterval;
  const maxCap         = getMaxCapacity(level);
  const newPending     = Math.min(existingPending + newCycles, maxCap);
  const isRunning      = newFuel > 0;

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

// Commit computed state to DB — always call this before mutating
async function commitState(animalId, state) {
  await query(
    `UPDATE player_animals
        SET fuel_remaining_minutes = $1,
            progress_minutes       = $2,
            pending_production     = $3,
            last_computed_at       = NOW()
      WHERE id = $4`,
    [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production, animalId]
  );
}

function buildAnimalResponse(a) {
  const now   = Date.now();
  const cfg   = ANIMAL_CONFIGS[a.animal_type];
  const level = a.level;
  const state = computeState(a, now);
  const minutesPerFeed = MINUTES_PER_FEED[a.animal_type];
  const maxFeedUnits   = a.max_feed ?? 30;
  const maxFuelMinutes = getMaxFuelMinutes(a.animal_type, maxFeedUnits);
  const intervalMinutes = getProduceInterval(a.animal_type, level);

  return {
    id:          a.id,
    animal_type: a.animal_type,
    level,
    // Display as integer feed units for the UI
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

// GET /api/animals — list all animals; auto-creates on first call
router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    let rows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE player_id = $1 ORDER BY animal_type ASC`,
      [playerId]
    );
    if (rows.length === 0) {
      for (const animalType of ['chicken', 'cow', 'sheep']) {
        await query(
          'INSERT INTO player_animals (player_id, animal_type, last_computed_at) VALUES ($1, $2, NOW())',
          [playerId, animalType]
        );
      }
      rows = await query(
        `SELECT ${SELECT_COLS} FROM player_animals WHERE player_id = $1 ORDER BY animal_type ASC`,
        [playerId]
      );
    }
    return res.json(rows.map(buildAnimalResponse));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch animals' });
  }
});

// POST /api/animals/:id/feed — feed +1 unit
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
    const maxFuelMinutes = getMaxFuelMinutes(animal.animal_type, animal.max_feed ?? 30);
    const state          = computeState(animal, Date.now());

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
      `UPDATE player_resources SET ${cfg.consumeResource} = ${cfg.consumeResource} - 1 WHERE player_id = $1`,
      [playerId]
    );

    // Commit computed state + add fuel
    await query(
      `UPDATE player_animals
          SET fuel_remaining_minutes = $1,
              progress_minutes       = $2,
              pending_production     = $3,
              last_computed_at       = NOW()
        WHERE id = $4`,
      [state.fuel_remaining_minutes + minutesPerFeed, state.progress_minutes, state.pending_production, animalId]
    );

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({ animal: buildAnimalResponse(updated), resources: updatedRes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Feed failed' });
  }
});

// POST /api/animals/:id/feed-max — fill feed storage to capacity
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
    const maxFuelMinutes = getMaxFuelMinutes(animal.animal_type, animal.max_feed ?? 30);
    const state          = computeState(animal, Date.now());

    const fuelNeeded    = maxFuelMinutes - state.fuel_remaining_minutes;
    const unitsNeeded   = Math.ceil(fuelNeeded / minutesPerFeed);

    if (unitsNeeded <= 0) return res.status(400).json({ error: 'Feed storage already full' });

    const resRows = await query(
      `SELECT ${cfg.consumeResource} FROM player_resources WHERE player_id = $1`,
      [playerId]
    );
    const available = resRows[0]?.[cfg.consumeResource] ?? 0;
    if (available < unitsNeeded) {
      return res.status(400).json({
        error: `Not enough ${cfg.consumeResource} (need ${unitsNeeded}, have ${available})`,
        needed: unitsNeeded, available,
      });
    }

    await query(
      `UPDATE player_resources SET ${cfg.consumeResource} = ${cfg.consumeResource} - $1 WHERE player_id = $2`,
      [unitsNeeded, playerId]
    );

    // Commit state + fill fuel to max
    await query(
      `UPDATE player_animals
          SET fuel_remaining_minutes = $1,
              progress_minutes       = $2,
              pending_production     = $3,
              last_computed_at       = NOW()
        WHERE id = $4`,
      [maxFuelMinutes, state.progress_minutes, state.pending_production, animalId]
    );

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({ animal: buildAnimalResponse(updated), resources: updatedRes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Feed-max failed' });
  }
});

// POST /api/animals/:id/collect — collect pending produce
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
    const state  = computeState(animal, Date.now());

    if (state.pending_production === 0) {
      return res.status(400).json({ error: 'Nothing to collect yet' });
    }

    const capCol  = `${cfg.produceResource}_cap`;
    const resRows = await query(
      `SELECT ${cfg.produceResource}, ${capCol} FROM player_resources WHERE player_id = $1`,
      [playerId]
    );
    const currentAmount = resRows[0]?.[cfg.produceResource] ?? 0;
    const cap           = resRows[0]?.[capCol] ?? 10;
    const freeSpace     = Math.max(0, cap - currentAmount);

    if (freeSpace === 0) return res.status(400).json({ error: 'Storage full' });

    const collectible = Math.min(state.pending_production, freeSpace);

    // Commit state with pending reduced by what was collected
    await query(
      `UPDATE player_animals
          SET fuel_remaining_minutes = $1,
              progress_minutes       = $2,
              pending_production     = $3,
              last_computed_at       = NOW()
        WHERE id = $4`,
      [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production - collectible, animalId]
    );
    await query(
      `UPDATE player_resources SET ${cfg.produceResource} = LEAST(${cfg.produceResource} + $1, ${capCol}) WHERE player_id = $2`,
      [collectible, playerId]
    );

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({
      collected:       collectible,
      produce_resource: cfg.produceResource,
      animal:          buildAnimalResponse(updated),
      resources:       updatedRes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Collect failed' });
  }
});

// POST /api/animals/:id/upgrade — level up an animal
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

    // Commit current state before level up (level change alters interval/capacity)
    const state = computeState(animal, Date.now());
    await commitState(animalId, state);

    await query(
      `UPDATE player_resources SET ${res1} = ${res1} - $1, ${res2} = ${res2} - $2 WHERE player_id = $3`,
      [cost, cost, playerId]
    );
    await query('UPDATE player_animals SET level = level + 1 WHERE id = $1', [animalId]);

    const [updated]    = await query(`SELECT ${SELECT_COLS} FROM player_animals WHERE id = $1`, [animalId]);
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);

    return res.json({ animal: buildAnimalResponse(updated), resources: updatedRes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upgrade failed' });
  }
});

// POST /api/animals/upgrade-storage — upgrade egg/wool/milk storage cap
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
