'use strict';

// Single source of truth for PvP balance — used by both pvpController.js and routes/players.js.
const LEAGUE_TIERS = [
  { name: 'Challenger',  min: 1600, win:  8, lose:  6 },
  { name: 'Grandmaster', min: 1300, win: 10, lose:  8 },
  { name: 'Master',      min: 1000, win: 12, lose: 10 },
  { name: 'Elmas',       min:  750, win: 15, lose: 12 },
  { name: 'Platinium',   min:  500, win: 18, lose: 14 },
  { name: 'Altin',       min:  300, win: 22, lose: 18 },
  { name: 'Gumus',       min:  150, win: 26, lose: 22 },
  { name: 'Bronz',       min:    0, win: 30, lose: 25 },
];

const TROPHY_FLOOR    = 10;
const RESULT_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// Loot: steal 15% of loser's actual resources per resource, min 1, no hard cap.
const LOOT_PCT = 0.15;
const LOOT_MIN = 1;

// Matchmaking trophy windows — expands progressively before falling back to bots.
const MATCHMAKING_WINDOWS = [30, 60, 200];

// Champion must reach this level before PvP is unlocked.
const PVP_UNLOCK_LEVEL = 3;

// Duration of the defense shield applied to a player after being attacked.
const DEFENSE_SHIELD_MINUTES = 15;

module.exports = {
  LEAGUE_TIERS,
  TROPHY_FLOOR,
  RESULT_DELAY_MS,
  LOOT_PCT,
  LOOT_MIN,
  MATCHMAKING_WINDOWS,
  PVP_UNLOCK_LEVEL,
  DEFENSE_SHIELD_MINUTES,
};
