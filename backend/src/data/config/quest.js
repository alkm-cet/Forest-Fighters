'use strict';

// Number of daily quests a player must claim to unlock the daily bonus.
const DAILY_QUEST_COUNT = 4;

// Daily completion bonus awarded when all daily quests are claimed.
const DAILY_BONUS_COINS    = 8;
const DAILY_BONUS_AMOUNT   = 3;
const DAILY_BONUS_RESOURCES = ['egg', 'wool', 'milk']; // one chosen at random

module.exports = {
  DAILY_QUEST_COUNT,
  DAILY_BONUS_COINS,
  DAILY_BONUS_AMOUNT,
  DAILY_BONUS_RESOURCES,
};
