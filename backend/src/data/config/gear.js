'use strict';

// Stat multipliers applied to base stats based on rarity.
const RARITY_MULT = { common: 1.0, rare: 1.35, epic: 1.75 };

// Probability that a dungeon victory produces a gear drop.
const DROP_CHANCE = {
  stage1: 1.00, // Stage 1 always drops (tutorial discovery)
  event:  0.35,
  boss:   0.28,
  level1: 0.10,
  level2: 0.08,
  level3: 0.06,
};

// Probability that a drop is a weapon (vs. charm).
const WEAPON_DROP_CHANCE = 0.6;

// Rarity distribution tables by dungeon context.
// Format: { common: threshold, rare: threshold } — epic is the remainder.
// Example: rarityRoll < common → common; rarityRoll < rare → rare; else → epic.
const RARITY_TABLE = {
  event:  { common: 0.00, rare: 0.60 }, // 0% common, 60% rare, 40% epic
  boss:   { common: 0.30, rare: 0.80 }, // 30% common, 50% rare, 20% epic
  level1: { common: 0.75, rare: 0.95 }, // 75% common, 20% rare, 5% epic
  level2: { common: 0.55, rare: 0.90 }, // 55% common, 35% rare, 10% epic
  level3: { common: 0.35, rare: 0.80 }, // 35% common, 45% rare, 20% epic
};

// Coin reward for discarding a piece of gear.
// Formula: DISCARD_RARITY_BONUS[rarity] + (tier - 1) + level
const DISCARD_RARITY_BONUS = { common: 0, rare: 2, epic: 4 };

module.exports = {
  RARITY_MULT,
  DROP_CHANCE,
  WEAPON_DROP_CHANCE,
  RARITY_TABLE,
  DISCARD_RARITY_BONUS,
};
