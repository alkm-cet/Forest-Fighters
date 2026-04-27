'use strict';

// Main resource storage cap progression.
const RESOURCE_CAP_START = 10;
const RESOURCE_CAP_MAX   = 100;
const RESOURCE_CAP_STEP  = 2; // each upgrade raises the cap by this amount

// Cost formula: +1 per upgrade tier, starting at 2.
// cap 10→12: cost 2 | cap 12→14: cost 3 | cap 14→16: cost 4 | …
function getCapUpgradeCost(currentCap) {
  return Math.ceil((currentCap - RESOURCE_CAP_START) / 2 + 2);
}

// Which two other resources each cap upgrade costs.
const CAP_UPGRADE_COSTS = {
  strawberry: ['pinecone',   'blueberry'],
  pinecone:   ['strawberry', 'blueberry'],
  blueberry:  ['strawberry', 'pinecone'],
};

const MAIN_RESOURCES = ['strawberry', 'pinecone', 'blueberry'];

module.exports = {
  RESOURCE_CAP_START,
  RESOURCE_CAP_MAX,
  RESOURCE_CAP_STEP,
  getCapUpgradeCost,
  CAP_UPGRADE_COSTS,
  MAIN_RESOURCES,
};
