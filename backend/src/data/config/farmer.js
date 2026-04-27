'use strict';

const FARMER_MAX_LEVEL = 50;

// Rate-based linear interpolation parameters.
// interval (minutes) = 60 / rate(level), where rate scales from baseRate (L1) to maxRate (L50).
const FARMER_RATES = {
  strawberry: { baseRate:  7.5, maxRate: 60  }, // L1=8min, L50=1min
  pinecone:   { baseRate:  5.0, maxRate: 30  }, // L1=12min, L50=2min
  blueberry:  { baseRate:  3.75,maxRate: 20  }, // L1=16min, L50=3min
  _default:   { baseRate:  6.0, maxRate: 30  },
};

// Returns the production interval in minutes for a given resource type and level.
function getIntervalMinutes(resourceType, level) {
  const L = Math.max(1, Math.min(FARMER_MAX_LEVEL, level));
  const { baseRate, maxRate } = FARMER_RATES[resourceType] ?? FARMER_RATES._default;
  const rate = baseRate + (maxRate - baseRate) * (L - 1) / (FARMER_MAX_LEVEL - 1);
  return 60 / rate;
}

// Capacity: L1=5, L2=6, … (4 + level)
function getMaxCapacity(level) { return 4 + level; }

// Upgrade cost per resource: current_level * 2
function getUpgradeCost(level) { return level * 2; }

// Cross-resource upgrade costs: resource_type → [costResource1, costResource2]
const UPGRADE_RESOURCES = {
  strawberry: ['strawberry', 'pinecone'],
  pinecone:   ['pinecone',   'blueberry'],
  blueberry:  ['blueberry',  'strawberry'],
};

module.exports = {
  FARMER_MAX_LEVEL,
  FARMER_RATES,
  UPGRADE_RESOURCES,
  getIntervalMinutes,
  getMaxCapacity,
  getUpgradeCost,
};
