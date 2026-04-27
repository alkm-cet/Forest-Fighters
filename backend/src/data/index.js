'use strict';

// ── Helpers ────────────────────────────────────────────────────────────────────
const { getLocalizedField, resolveContent } = require('./helpers/i18n');

// ── Content (DB-seeded game data, has translatable text fields) ────────────────
const { HARVEST_DUNGEONS }              = require('./content/harvestDungeons');
const { ADVENTURE_STAGES }              = require('./content/adventureStages');
const { RECIPES, FORGE_STONES }         = require('./content/recipes');
const { QUEST_DEFINITIONS }             = require('./content/questDefinitions');
const { GEAR_DEFINITIONS }              = require('./content/gearDefinitions');
const { STAR_MILESTONES }               = require('./content/starMilestones');
const { CLASS_STATS, STARTER_CHAMPIONS } = require('./content/starterChampions');
const { BOT_PLAYERS }                   = require('./content/botPlayers');

// ── Config (runtime constants and formulas, never seeded directly) ─────────────
const pvpConfig      = require('./config/pvp');
const championConfig = require('./config/champion');
const farmerConfig   = require('./config/farmer');
const animalConfig   = require('./config/animal');
const farmConfig     = require('./config/farm');
const resourceConfig = require('./config/resource');
const gearConfig     = require('./config/gear');
const coinConfig     = require('./config/coin');
const questConfig    = require('./config/quest');

module.exports = {
  // helpers
  getLocalizedField,
  resolveContent,

  // content
  HARVEST_DUNGEONS,
  ADVENTURE_STAGES,
  RECIPES,
  FORGE_STONES,
  QUEST_DEFINITIONS,
  GEAR_DEFINITIONS,
  STAR_MILESTONES,
  CLASS_STATS,
  STARTER_CHAMPIONS,
  BOT_PLAYERS,

  // config namespaces (kept namespaced to prevent name collisions)
  pvpConfig,
  championConfig,
  farmerConfig,
  animalConfig,
  farmConfig,
  resourceConfig,
  gearConfig,
  coinConfig,
  questConfig,
};
