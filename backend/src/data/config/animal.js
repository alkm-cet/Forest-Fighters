'use strict';

const ANIMAL_MAX_LEVEL = 50;

// Minutes of fuel added per single feed unit consumed.
const MINUTES_PER_FEED = {
  chicken:  5,  // 4 feeds = 20 min = 1 egg  (L1)
  sheep:    8,  // 4 feeds = 32 min = 1 wool (L1)
  cow:     10,  // 4 feeds = 40 min = 1 milk (L1)
};

// Production interval range (minutes per item): base at L1, min at L50.
const PRODUCE_INTERVAL_PARAMS = {
  chicken: { base: 20, min:  5 },
  sheep:   { base: 32, min:  8 },
  cow:     { base: 40, min: 10 },
};

// Returns the production interval in minutes for a given animal type and level.
function getProduceInterval(animalType, level) {
  const L = Math.max(1, Math.min(ANIMAL_MAX_LEVEL, level));
  const { base, min } = PRODUCE_INTERVAL_PARAMS[animalType];
  return base - (base - min) * (L - 1) / (ANIMAL_MAX_LEVEL - 1);
}

// Pending production storage capacity: L1=10, L2=11, …
function getMaxCapacity(level) { return 9 + level; }

// Feed unit capacity: same formula as production capacity.
function getMaxFeed(level) { return 9 + level; }

// Maximum fuel in minutes given animal type and level.
function getMaxFuelMinutes(animalType, level) {
  return getMaxFeed(level) * MINUTES_PER_FEED[animalType];
}

// Upgrade cost per resource: current_level * 2
function getUpgradeCost(level) { return level * 2; }

// Resource mappings: what each animal consumes and produces.
const ANIMAL_CONFIGS = {
  chicken: { consumeResource: 'strawberry', produceResource: 'egg'  },
  sheep:   { consumeResource: 'pinecone',   produceResource: 'wool' },
  cow:     { consumeResource: 'blueberry',  produceResource: 'milk' },
};

// Cross-resource upgrade costs: animal_type → [costResource1, costResource2]
const UPGRADE_RESOURCES = {
  chicken: ['strawberry', 'pinecone'],
  sheep:   ['pinecone',   'blueberry'],
  cow:     ['blueberry',  'strawberry'],
};

// Storage cap upgrade costs for animal produce resources.
const STORAGE_UPGRADE_COST = {
  egg:  { res1: 'strawberry', res2: 'pinecone',   cost1: 20, cost2: 10 },
  wool: { res1: 'pinecone',   res2: 'blueberry',  cost1: 20, cost2: 10 },
  milk: { res1: 'blueberry',  res2: 'strawberry', cost1: 20, cost2: 10 },
};

const ANIMAL_CAP_MAX  = 100;
const ANIMAL_CAP_STEP = 2;

// Initial fuel when an animal is first created (gives the player something to collect right away).
const INITIAL_FUEL = { chicken: 50, sheep: 80, cow: 100 };

module.exports = {
  ANIMAL_MAX_LEVEL,
  MINUTES_PER_FEED,
  PRODUCE_INTERVAL_PARAMS,
  ANIMAL_CONFIGS,
  UPGRADE_RESOURCES,
  STORAGE_UPGRADE_COST,
  ANIMAL_CAP_MAX,
  ANIMAL_CAP_STEP,
  INITIAL_FUEL,
  getProduceInterval,
  getMaxCapacity,
  getMaxFeed,
  getMaxFuelMinutes,
  getUpgradeCost,
};
