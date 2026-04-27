'use strict';

// Flat coin cost for instant champion revive.
const COIN_REVIVE_COST = 15;

// Hard cap on player coin balance.
const MAX_COINS = 999999;

// Coin heal formula: ceil(missingHp / HP_PER_UNIT) * COST_PER_UNIT
const COIN_HEAL_HP_PER_UNIT   = 20;
const COIN_HEAL_COST_PER_UNIT  = 4;

// Coin skip formula for dungeons and PvP: max(1, ceil(secondsRemaining / 60))
// No separate constant needed — the formula is applied inline.

module.exports = {
  COIN_REVIVE_COST,
  MAX_COINS,
  COIN_HEAL_HP_PER_UNIT,
  COIN_HEAL_COST_PER_UNIT,
};
