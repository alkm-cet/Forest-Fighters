'use strict';

// Revive cost — scales with champion level: (REVIVE_BASE + level) of each resource.
const REVIVE_BASE_COST = 5; // actual cost = REVIVE_BASE_COST + champion.level

// Heal cost (resource heal, not coin heal).
const HEAL_MILK_COST = 5;
const HEAL_EGG_COST  = 5;
const HEAL_AMOUNT_HP = 20; // HP restored per heal action

// Coin revive — flat cost regardless of level.
const COIN_REVIVE_COST = 15;

// Coin heal formula: ceil(missingHp / COIN_HEAL_HP_PER_UNIT) * COIN_HEAL_COST_PER_UNIT.
const COIN_HEAL_HP_PER_UNIT   = 20;
const COIN_HEAL_COST_PER_UNIT  = 4;

// Legacy one-battle boosts (pre-food system).
const BOOST_COSTS = {
  hp:      { resource: 'egg',  amount: 4, value: 10 },
  defense: { resource: 'wool', amount: 3, value:  5 },
  chance:  { resource: 'milk', amount: 3, value:  5 },
};

// Gear stat cap: gear bonuses are capped at this fraction of the champion's base stat.
const GEAR_BONUS_CAP_PCT = 0.5;

module.exports = {
  REVIVE_BASE_COST,
  HEAL_MILK_COST,
  HEAL_EGG_COST,
  HEAL_AMOUNT_HP,
  COIN_REVIVE_COST,
  COIN_HEAL_HP_PER_UNIT,
  COIN_HEAL_COST_PER_UNIT,
  BOOST_COSTS,
  GEAR_BONUS_CAP_PCT,
};
