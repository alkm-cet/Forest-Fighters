const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { incrementQuestProgress } = require('../quests');
const {
  ANIMAL_MAX_LEVEL, MINUTES_PER_FEED, ANIMAL_CONFIGS, UPGRADE_RESOURCES,
  getProduceInterval, getMaxCapacity, getMaxFeed, getMaxFuelMinutes, getUpgradeCost,
} = require('../data/config/animal');
const { MAX_FARM_SLOTS, FARM_UPGRADE_COST_PER_LEVEL } = require('../data/config/farm');

const SELECT_COLS = 'id, animal_type, level, fuel_remaining_minutes, progress_minutes, pending_production, last_computed_ms, farm_id';

function computeState(animal, nowMs) {
  const level           = animal.level;
  const produceInterval = getProduceInterval(animal.animal_type, level);
  const _parsed         = parseInt(animal.last_computed_ms);
  const lastComputedMs  = _parsed > 0 ? _parsed : nowMs;
  const elapsedMin      = Math.max(0, (nowMs - lastComputedMs) / 60000);
  const fuelRemaining   = parseFloat(animal.fuel_remaining_minutes) || 0;
  const progressMin     = parseFloat(animal.progress_minutes)       || 0;
  const existingPending = parseInt(animal.pending_production)       || 0;
  const maxCap          = getMaxCapacity(level);
  const canRun          = fuelRemaining > 0 && existingPending < maxCap;
  const actualRunMin    = canRun ? Math.min(elapsedMin, fuelRemaining) : 0;
  const newFuel         = fuelRemaining - actualRunMin;
  const totalProgress   = progressMin + actualRunMin;
  const newCycles       = Math.floor(totalProgress / produceInterval);
  const newProgress     = totalProgress % produceInterval;
  const newPending      = Math.min(existingPending + newCycles, maxCap);
  const isRunning       = newFuel > 0 && newPending < maxCap;
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

async function commitState(animalId, state, nowMs) {
  await query(
    `UPDATE player_animals SET fuel_remaining_minutes=$1, progress_minutes=$2, pending_production=$3, last_computed_ms=$4 WHERE id=$5`,
    [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production, nowMs, animalId]
  );
}

function buildAnimalResponse(a, nowMs) {
  const now             = nowMs ?? Date.now();
  const cfg             = ANIMAL_CONFIGS[a.animal_type];
  const level           = a.level;
  const state           = computeState(a, now);
  const minutesPerFeed  = MINUTES_PER_FEED[a.animal_type];
  const maxFeedUnits    = getMaxFeed(level);
  const maxFuelMinutes  = getMaxFuelMinutes(a.animal_type, level);
  const intervalMinutes = getProduceInterval(a.animal_type, level);
  return {
    id:                     a.id,
    animal_type:            a.animal_type,
    farm_id:                a.farm_id,
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

function buildFarmResponse(farm, animalResponses, cfg) {
  return {
    id:               farm.id,
    farm_type:        farm.farm_type,
    level:            farm.level,
    slot_count:       Math.min(farm.level, MAX_FARM_SLOTS),
    animals:          animalResponses,
    total_pending:    animalResponses.reduce((s, a) => s + (a.pending || 0), 0),
    produce_resource: cfg.produceResource,
    consume_resource: cfg.consumeResource,
  };
}

// ─── GET /api/farms ───────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const nowMs = Date.now();

    // Ensure all 3 farms exist for this player
    for (const farmType of ['chicken', 'sheep', 'cow']) {
      await query(
        `INSERT INTO player_farms (player_id, farm_type, level) VALUES ($1, $2, 1) ON CONFLICT (player_id, farm_type) DO NOTHING`,
        [playerId, farmType]
      );
    }

    const farms = await query(
      `SELECT id, farm_type, level FROM player_farms WHERE player_id=$1 ORDER BY farm_type ASC`,
      [playerId]
    );

    const result = [];

    for (const farm of farms) {
      // Link any unlinked animals of this type to this farm
      await query(
        `UPDATE player_animals SET farm_id=$1 WHERE player_id=$2 AND animal_type=$3 AND farm_id IS NULL`,
        [farm.id, playerId, farm.farm_type]
      );

      // Ensure at least 1 animal exists in this farm
      const countRows = await query(
        `SELECT COUNT(*) as count FROM player_animals WHERE farm_id=$1`,
        [farm.id]
      );
      if (parseInt(countRows[0].count) === 0) {
        const INITIAL_FUEL    = { chicken: 50, sheep: 80, cow: 100 };
        const initialFuel     = INITIAL_FUEL[farm.farm_type] ?? 50;
        const initialPending  = getMaxCapacity(1);
        await query(
          `INSERT INTO player_animals (player_id, animal_type, last_computed_ms, farm_id, fuel_remaining_minutes, pending_production)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [playerId, farm.farm_type, nowMs, farm.id, initialFuel, initialPending]
        );
      }

      const animals = await query(
        `SELECT ${SELECT_COLS} FROM player_animals WHERE farm_id=$1 ORDER BY id ASC`,
        [farm.id]
      );

      // Compute and commit state for all animals
      const states = animals.map(a => ({ animal: a, state: computeState(a, nowMs) }));
      await Promise.all(states.map(({ animal, state }) => commitState(animal.id, state, nowMs)));

      const animalResponses = states.map(({ animal, state }) => {
        const cfg = ANIMAL_CONFIGS[animal.animal_type];
        const level = animal.level;
        const minutesPerFeed  = MINUTES_PER_FEED[animal.animal_type];
        const maxFeedUnits    = getMaxFeed(level);
        const maxFuelMinutes  = getMaxFuelMinutes(animal.animal_type, level);
        const intervalMinutes = getProduceInterval(animal.animal_type, level);
        return {
          id:                     animal.id,
          animal_type:            animal.animal_type,
          farm_id:                animal.farm_id,
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
      });

      result.push(buildFarmResponse(farm, animalResponses, ANIMAL_CONFIGS[farm.farm_type]));
    }

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// ─── POST /api/farms/:type/collect ────────────────────────────────────────────
router.post('/:type/collect', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const farmType = req.params.type;

  if (!['chicken', 'sheep', 'cow'].includes(farmType)) {
    return res.status(400).json({ error: 'Invalid farm type' });
  }

  try {
    const farmRows = await query(
      `SELECT id, farm_type, level FROM player_farms WHERE player_id=$1 AND farm_type=$2`,
      [playerId, farmType]
    );
    if (!farmRows.length) return res.status(404).json({ error: 'Farm not found' });
    const farm = farmRows[0];

    const cfg = ANIMAL_CONFIGS[farmType];
    const capCol = `${cfg.produceResource}_cap`;
    const nowMs = Date.now();

    const animals = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE farm_id=$1`,
      [farm.id]
    );

    const resRows = await query(
      `SELECT ${cfg.produceResource}, ${capCol} FROM player_resources WHERE player_id=$1`,
      [playerId]
    );
    const currentAmount = resRows[0]?.[cfg.produceResource] ?? 0;
    const cap = resRows[0]?.[capCol] ?? 10;
    let freeSpace = Math.max(0, cap - currentAmount);

    if (freeSpace === 0) return res.status(400).json({ error: 'Storage full' });

    let totalCollected = 0;

    for (const animal of animals) {
      if (freeSpace <= 0) break;
      const state = computeState(animal, nowMs);
      if (state.pending_production === 0) continue;

      const collectible = Math.min(state.pending_production, freeSpace);
      await query(
        `UPDATE player_animals SET fuel_remaining_minutes=$1, progress_minutes=$2, pending_production=$3, last_computed_ms=$4 WHERE id=$5`,
        [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production - collectible, nowMs, animal.id]
      );
      totalCollected += collectible;
      freeSpace -= collectible;
    }

    if (totalCollected > 0) {
      await query(
        `UPDATE player_resources SET ${cfg.produceResource} = LEAST(${cfg.produceResource} + $1, ${capCol}) WHERE player_id=$2`,
        [totalCollected, playerId]
      );
      await incrementQuestProgress(playerId, 'animal_collect', {
        resourceType: cfg.produceResource,
        animalType:   farmType,
        amount:       totalCollected,
      });
    }

    const updatedAnimals = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE farm_id=$1 ORDER BY id ASC`,
      [farm.id]
    );
    const animalResponses = updatedAnimals.map(a => buildAnimalResponse(a, nowMs));
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id=$1', [playerId]);

    return res.json({
      collected:        totalCollected,
      produce_resource: cfg.produceResource,
      farm:             buildFarmResponse(farm, animalResponses, cfg),
      resources:        updatedRes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Collect failed' });
  }
});

// ─── POST /api/farms/:type/animals/:animalId/collect ─────────────────────────
// Collect produce from a single animal.
router.post('/:type/animals/:animalId/collect', authMiddleware, async (req, res) => {
  const playerId  = req.player.id;
  const farmType  = req.params.type;
  const animalId  = req.params.animalId;

  if (!['chicken', 'sheep', 'cow'].includes(farmType)) {
    return res.status(400).json({ error: 'Invalid farm type' });
  }

  try {
    const farmRows = await query(
      `SELECT id, farm_type, level FROM player_farms WHERE player_id=$1 AND farm_type=$2`,
      [playerId, farmType]
    );
    if (!farmRows.length) return res.status(404).json({ error: 'Farm not found' });
    const farm = farmRows[0];

    const animalRows = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE id=$1 AND farm_id=$2`,
      [animalId, farm.id]
    );
    if (!animalRows.length) return res.status(404).json({ error: 'Animal not found' });
    const animal = animalRows[0];

    const cfg    = ANIMAL_CONFIGS[farmType];
    const nowMs  = Date.now();
    const state  = computeState(animal, nowMs);

    if (state.pending_production === 0) {
      return res.status(400).json({ error: 'Nothing to collect' });
    }

    const capCol = `${cfg.produceResource}_cap`;
    const [resRow] = await query(
      `SELECT ${cfg.produceResource}, ${capCol} FROM player_resources WHERE player_id=$1`,
      [playerId]
    );
    const currentAmount = resRow?.[cfg.produceResource] ?? 0;
    const cap           = resRow?.[capCol] ?? 10;
    const freeSpace     = Math.max(0, cap - currentAmount);

    if (freeSpace === 0) return res.status(400).json({ error: 'Storage full' });

    const collectible = Math.min(state.pending_production, freeSpace);

    await query(
      `UPDATE player_animals SET fuel_remaining_minutes=$1, progress_minutes=$2, pending_production=$3, last_computed_ms=$4 WHERE id=$5`,
      [state.fuel_remaining_minutes, state.progress_minutes, state.pending_production - collectible, nowMs, animal.id]
    );
    await query(
      `UPDATE player_resources SET ${cfg.produceResource} = LEAST(${cfg.produceResource} + $1, ${capCol}) WHERE player_id=$2`,
      [collectible, playerId]
    );
    await incrementQuestProgress(playerId, 'animal_collect', {
      resourceType: cfg.produceResource,
      animalType:   farmType,
      amount:       collectible,
    });

    const updatedAnimals = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE farm_id=$1 ORDER BY id ASC`,
      [farm.id]
    );
    const animalResponses = updatedAnimals.map(a => buildAnimalResponse(a, nowMs));
    const [updatedRes]    = await query('SELECT * FROM player_resources WHERE player_id=$1', [playerId]);

    return res.json({
      collected:        collectible,
      produce_resource: cfg.produceResource,
      farm:             buildFarmResponse(farm, animalResponses, cfg),
      resources:        updatedRes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Animal collect failed' });
  }
});

// ─── POST /api/farms/:type/upgrade ───────────────────────────────────────────
// Increases farm level by 1, unlocking a new animal slot. Costs level*10 pinecones.
router.post('/:type/upgrade', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const farmType = req.params.type;

  if (!['chicken', 'sheep', 'cow'].includes(farmType)) {
    return res.status(400).json({ error: 'Invalid farm type' });
  }

  try {
    const farmRows = await query(
      `SELECT id, farm_type, level FROM player_farms WHERE player_id=$1 AND farm_type=$2`,
      [playerId, farmType]
    );
    if (!farmRows.length) return res.status(404).json({ error: 'Farm not found' });
    const farm = farmRows[0];

    if (farm.level >= MAX_FARM_SLOTS) {
      return res.status(400).json({ error: 'Farm already at max level' });
    }

    const cost = farm.level * FARM_UPGRADE_COST_PER_LEVEL;
    const [playerRes] = await query('SELECT * FROM player_resources WHERE player_id=$1', [playerId]);

    if (
      (playerRes.strawberry ?? 0) < cost ||
      (playerRes.pinecone   ?? 0) < cost ||
      (playerRes.blueberry  ?? 0) < cost
    ) {
      return res.status(400).json({
        error: `Not enough resources (need ${cost} strawberry + ${cost} pinecone + ${cost} blueberry)`,
        cost,
      });
    }

    await query(
      `UPDATE player_resources SET strawberry = strawberry - $1, pinecone = pinecone - $2, blueberry = blueberry - $3 WHERE player_id=$4`,
      [cost, cost, cost, playerId]
    );
    await query(`UPDATE player_farms SET level = level + 1 WHERE id=$1`, [farm.id]);

    const [updatedFarm] = await query(
      `SELECT id, farm_type, level FROM player_farms WHERE id=$1`,
      [farm.id]
    );
    const cfg = ANIMAL_CONFIGS[farmType];
    const nowMs = Date.now();
    const animals = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE farm_id=$1 ORDER BY id ASC`,
      [farm.id]
    );
    const animalResponses = animals.map(a => buildAnimalResponse(a, nowMs));
    const [updatedRes] = await query('SELECT * FROM player_resources WHERE player_id=$1', [playerId]);

    return res.json({
      farm:      buildFarmResponse(updatedFarm, animalResponses, cfg),
      resources: updatedRes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Farm upgrade failed' });
  }
});

// ─── POST /api/farms/:type/animals ────────────────────────────────────────────
// Add a new animal to an available slot in the farm.
router.post('/:type/animals', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const farmType = req.params.type;

  if (!['chicken', 'sheep', 'cow'].includes(farmType)) {
    return res.status(400).json({ error: 'Invalid farm type' });
  }

  try {
    const farmRows = await query(
      `SELECT id, farm_type, level FROM player_farms WHERE player_id=$1 AND farm_type=$2`,
      [playerId, farmType]
    );
    if (!farmRows.length) return res.status(404).json({ error: 'Farm not found' });
    const farm = farmRows[0];

    const countRows = await query(
      `SELECT COUNT(*) as count FROM player_animals WHERE farm_id=$1`,
      [farm.id]
    );
    const currentCount = parseInt(countRows[0].count);
    const maxSlots = Math.min(farm.level, MAX_FARM_SLOTS);

    if (currentCount >= maxSlots) {
      return res.status(400).json({ error: 'No available slots' });
    }

    const nowMs = Date.now();
    const cfg = ANIMAL_CONFIGS[farmType];

    await query(
      `INSERT INTO player_animals (player_id, animal_type, last_computed_ms, farm_id) VALUES ($1, $2, $3, $4)`,
      [playerId, farmType, nowMs, farm.id]
    );

    const animals = await query(
      `SELECT ${SELECT_COLS} FROM player_animals WHERE farm_id=$1 ORDER BY id ASC`,
      [farm.id]
    );
    const animalResponses = animals.map(a => buildAnimalResponse(a, nowMs));

    return res.json({
      farm: buildFarmResponse(farm, animalResponses, cfg),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add animal' });
  }
});

module.exports = router;
