'use strict';

// Maximum number of farm slots a player can have.
const MAX_FARM_SLOTS = 20;

// Farm upgrade costs level * FARM_UPGRADE_COST_PER_LEVEL of each main resource.
const FARM_UPGRADE_COST_PER_LEVEL = 5;

const FARM_TYPES = ['chicken', 'sheep', 'cow'];

module.exports = { MAX_FARM_SLOTS, FARM_UPGRADE_COST_PER_LEVEL, FARM_TYPES };
