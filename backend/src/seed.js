require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('./db');

async function seed() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    const existing = await query('SELECT id FROM players WHERE email = $1', ['test@test.com']);
    const playerExists = existing.length > 0;
    if (playerExists) {
      console.log('Test player already exists. Skipping player seed.');
    }

    if (!playerExists) {
      const playerRows = await query(
        'INSERT INTO players (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['testplayer', 'test@test.com', passwordHash]
      );
      const playerId = playerRows[0].id;
      console.log('Created player:', playerId);

      await query(
        'INSERT INTO player_resources (player_id, strawberry, pinecone, blueberry) VALUES ($1, $2, $3, $4)',
        [playerId, 10, 10, 10]
      );
      console.log('Added starting resources');

      const champions = [
        { name: 'Oak Warrior', class: 'Warrior' },
        { name: 'Forest Mage', class: 'Mage' },
        { name: 'Pine Archer', class: 'Archer' },
      ];
      for (const c of champions) {
        await query(
          'INSERT INTO champions (player_id, name, class) VALUES ($1, $2, $3)',
          [playerId, c.name, c.class]
        );
      }
      console.log('Added 3 champions');

      const farmerTypes = ['strawberry', 'pinecone', 'blueberry'];
      for (const type of farmerTypes) {
        await query(
          'INSERT INTO farmers (player_id, name, resource_type) VALUES ($1, $2, $3)',
          [playerId, `${type} farmer`, type]
        );
      }
      console.log('Added 3 farmers');
    }

    // Seed dungeons (idempotent — skip if already exist)
    const existingDungeons = await query('SELECT id FROM dungeons LIMIT 1');
    if (existingDungeons.length === 0) {
      const dungeons = [
        { name: 'Whispering Woods', description: 'A peaceful forest hiding a mischievous goblin.', enemy_name: 'Goblin', enemy_attack: 8, enemy_defense: 4, enemy_chance: 15, enemy_hp: 60, duration_minutes: 5, reward_resource: 'pinecone', reward_amount: 8 },
        { name: 'Mossy Ruins', description: 'Ancient stone ruins where the restless dead wander.', enemy_name: 'Skeleton', enemy_attack: 12, enemy_defense: 6, enemy_chance: 20, enemy_hp: 75, duration_minutes: 10, reward_resource: 'strawberry', reward_amount: 5 },
        { name: 'Troll Bridge', description: 'A rickety bridge guarded by a grumpy troll.', enemy_name: 'Troll', enemy_attack: 18, enemy_defense: 12, enemy_chance: 10, enemy_hp: 100, duration_minutes: 15, reward_resource: 'pinecone', reward_amount: 12 },
        { name: 'Orcish Camp', description: 'A fortified camp filled with battle-hungry orcs.', enemy_name: 'Orc', enemy_attack: 22, enemy_defense: 15, enemy_chance: 18, enemy_hp: 110, duration_minutes: 20, reward_resource: 'blueberry', reward_amount: 8 },
        { name: 'Dark Sanctum', description: 'A forbidden shrine where a dark mage channels ancient power.', enemy_name: 'Dark Mage', enemy_attack: 28, enemy_defense: 10, enemy_chance: 35, enemy_hp: 90, duration_minutes: 30, reward_resource: 'blueberry', reward_amount: 15 },
      ];
      for (const d of dungeons) {
        await query(
          `INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp, duration_minutes, reward_resource, reward_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [d.name, d.description, d.enemy_name, d.enemy_attack, d.enemy_defense, d.enemy_chance, d.enemy_hp, d.duration_minutes, d.reward_resource, d.reward_amount]
        );
      }
      console.log('Added 5 dungeons');
    } else {
      console.log('Dungeons already seeded. Skipping.');
    }

    // ── Bot players for PvP matchmaking ──────────────────────────────────────
    const existingBots = await query(`SELECT id FROM players WHERE is_bot = TRUE LIMIT 1`);
    if (existingBots.length === 0) {
      const botDefs = [
        { username: 'ForestGuardian', email: 'bot1@bots.internal', trophies: 12, champions: [{ name: 'Stone Warrior', class: 'Warrior' }, { name: 'Ember Mage', class: 'Mage' }], defIdx: 0 },
        { username: 'WildHunter',     email: 'bot2@bots.internal', trophies: 25, champions: [{ name: 'Shadow Archer', class: 'Archer' }, { name: 'Iron Guard', class: 'Warrior' }], defIdx: 0 },
        { username: 'AncientDruid',   email: 'bot3@bots.internal', trophies: 55, champions: [{ name: 'Storm Mage', class: 'Mage' }, { name: 'Vine Archer', class: 'Archer' }], defIdx: 0 },
      ];

      const botHash = await bcrypt.hash('botpassword_never_used', 10);

      for (const bot of botDefs) {
        const botRow = await query(
          `INSERT INTO players (username, email, password_hash, trophies, is_bot) VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
          [bot.username, bot.email, botHash, bot.trophies]
        );
        const botId = botRow[0].id;

        await query(
          'INSERT INTO player_resources (player_id, strawberry, pinecone, blueberry) VALUES ($1, 30, 30, 30)',
          [botId]
        );
        await query(
          'UPDATE players SET pvp_storage_strawberry = 30, pvp_storage_pinecone = 30, pvp_storage_blueberry = 30 WHERE id = $1',
          [botId]
        );

        const champIds = [];
        for (const c of bot.champions) {
          const cRow = await query(
            'INSERT INTO champions (player_id, name, class) VALUES ($1, $2, $3) RETURNING id',
            [botId, c.name, c.class]
          );
          champIds.push(cRow[0].id);
        }

        // Set defender to first champion
        await query('UPDATE players SET defender_champion_id = $1 WHERE id = $2', [champIds[bot.defIdx], botId]);
      }

      console.log('Added 3 bot players for PvP');
    } else {
      console.log('Bot players already seeded. Skipping.');
    }

    // ── Quest definitions (idempotent) ────────────────────────────────────────
    const questCheck = await query('SELECT 1 FROM quest_definitions LIMIT 1');
    if (questCheck.length === 0) {
      const quests = [
        // ── Daily: EASY pool (pick 1, scale: t1=1.0 t2=1.0 t3=1.5) ──────────
        { title: 'Enter a Dungeon',       description: 'Enter any adventure dungeon.',           quest_type: 'daily', difficulty: 'easy',   category: 'dungeon',  action_key: 'dungeon_enter_adventure', target_count: 1,  reward_coins: 2,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.0, t3: 1.5 } },
        { title: 'Collect from a Farmer', description: 'Collect resources from any farmer.',     quest_type: 'daily', difficulty: 'easy',   category: 'resource', action_key: 'farmer_collect',          target_count: 1,  reward_coins: 2,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.0, t3: 1.5 } },
        { title: 'Feed an Animal',        description: 'Feed any animal once.',                  quest_type: 'daily', difficulty: 'easy',   category: 'animal',   action_key: 'animal_feed',             target_count: 1,  reward_coins: 2,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.0, t3: 1.5 } },
        { title: 'Cook a Meal',           description: 'Cook any meal in the kitchen.',          quest_type: 'daily', difficulty: 'easy',   category: 'cooking',  action_key: 'kitchen_cook',            target_count: 1,  reward_coins: 2,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.0, t3: 1.5 } },
        { title: 'Start a PvP Battle',    description: 'Start a PvP battle.',                    quest_type: 'daily', difficulty: 'easy',   category: 'pvp',      action_key: 'pvp_attack',              target_count: 1,  reward_coins: 2,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.0, t3: 1.5 } },
        // ── Daily: MEDIUM pool (pick 1, scale: t1=1.0 t2=1.5 t3=2.5) ─────────
        { title: 'Feed Animals',                description: 'Feed any animal.',                           quest_type: 'daily', difficulty: 'medium', category: 'animal',   action_key: 'animal_feed',             target_count: 3,  reward_coins: 4,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Collect from Farmers',        description: 'Collect resources from farmers.',            quest_type: 'daily', difficulty: 'medium', category: 'resource', action_key: 'farmer_collect',          target_count: 3,  reward_coins: 4,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Complete Harvest Dungeons',   description: 'Win harvest dungeon runs.',                  quest_type: 'daily', difficulty: 'medium', category: 'dungeon',  action_key: 'dungeon_claim_harvest',   target_count: 2,  reward_coins: 4,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Use a Prepared Meal',         description: 'Use a meal from your inventory.',           quest_type: 'daily', difficulty: 'medium', category: 'cooking',  action_key: 'kitchen_use',             target_count: 1,  reward_coins: 4,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Win a PvP Battle',            description: 'Win a PvP battle.',                         quest_type: 'daily', difficulty: 'medium', category: 'pvp',      action_key: 'pvp_win',                 target_count: 1,  reward_coins: 4,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        // ── Daily: ACTION pool (pick 1, scale: t1=1.0 t2=1.5 t3=2.0) ─────────
        { title: 'PvP Warrior',                  description: 'Start a PvP battle.',                       quest_type: 'daily', difficulty: 'action', category: 'pvp',      action_key: 'pvp_attack',              target_count: 1,  reward_coins: 6,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Upgrade Something',            description: 'Upgrade any farmer or animal once.',        quest_type: 'daily', difficulty: 'action', category: 'upgrade',  action_key: 'any_upgrade',             target_count: 1,  reward_coins: 6,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Collect Animal Products',      description: 'Collect produce from animals.',              quest_type: 'daily', difficulty: 'action', category: 'animal',   action_key: 'animal_collect',          target_count: 3,  reward_coins: 6,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Complete an Adventure Dungeon',description: 'Win any adventure dungeon.',                quest_type: 'daily', difficulty: 'action', category: 'dungeon',  action_key: 'dungeon_claim_adventure', target_count: 1,  reward_coins: 6,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Cook Meals',                   description: 'Cook meals in the kitchen.',                quest_type: 'daily', difficulty: 'action', category: 'cooking',  action_key: 'kitchen_cook',            target_count: 2,  reward_coins: 6,  metadata: {},                          scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        // ── Daily: PASSIVE pool (pick 1, scale: t1=1.0 t2=2.0 t3=3.5) ────────
        { title: 'Gather Pinecone',   description: 'Collect pinecone from farmers.',  quest_type: 'daily', difficulty: 'passive', category: 'resource', action_key: 'farmer_collect', target_count: 20, reward_coins: 3, metadata: { resourceType: 'pinecone'   }, scale_factors: { t1: 1.0, t2: 2.0, t3: 3.5 } },
        { title: 'Gather Strawberry', description: 'Collect strawberry from farmers.',quest_type: 'daily', difficulty: 'passive', category: 'resource', action_key: 'farmer_collect', target_count: 20, reward_coins: 3, metadata: { resourceType: 'strawberry' }, scale_factors: { t1: 1.0, t2: 2.0, t3: 3.5 } },
        { title: 'Gather Blueberry',  description: 'Collect blueberry from farmers.', quest_type: 'daily', difficulty: 'passive', category: 'resource', action_key: 'farmer_collect', target_count: 15, reward_coins: 3, metadata: { resourceType: 'blueberry'  }, scale_factors: { t1: 1.0, t2: 2.0, t3: 3.5 } },
        { title: 'Collect Eggs',      description: 'Collect eggs from chickens.',     quest_type: 'daily', difficulty: 'passive', category: 'animal',   action_key: 'animal_collect', target_count: 10, reward_coins: 3, metadata: { resourceType: 'egg'        }, scale_factors: { t1: 1.0, t2: 2.0, t3: 3.5 } },
        { title: 'Collect Wool',      description: 'Collect wool from sheep.',        quest_type: 'daily', difficulty: 'passive', category: 'animal',   action_key: 'animal_collect', target_count: 10, reward_coins: 3, metadata: { resourceType: 'wool'       }, scale_factors: { t1: 1.0, t2: 2.0, t3: 3.5 } },
        { title: 'Collect Milk',      description: 'Collect milk from cows.',         quest_type: 'daily', difficulty: 'passive', category: 'animal',   action_key: 'animal_collect', target_count: 10, reward_coins: 3, metadata: { resourceType: 'milk'       }, scale_factors: { t1: 1.0, t2: 2.0, t3: 3.5 } },
        // ── Weekly: WEEKLY_EASY pool (pick 1, scale: t1=1.0 t2=1.5 t3=2.0) ───
        { title: 'PvP Participant',   description: 'Start PvP battles.',                   quest_type: 'weekly', difficulty: 'weekly_easy', category: 'pvp',      action_key: 'pvp_attack',              target_count: 3,  reward_coins: 15, metadata: {}, scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Kitchen Student',   description: 'Cook meals.',                         quest_type: 'weekly', difficulty: 'weekly_easy', category: 'cooking',  action_key: 'kitchen_cook',            target_count: 3,  reward_coins: 15, metadata: {}, scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Dungeon Explorer',  description: 'Enter adventure dungeons.',           quest_type: 'weekly', difficulty: 'weekly_easy', category: 'dungeon',  action_key: 'dungeon_enter_adventure', target_count: 3,  reward_coins: 15, metadata: {}, scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        { title: 'Diligent Farmer',   description: 'Collect resources from farmers.',     quest_type: 'weekly', difficulty: 'weekly_easy', category: 'resource', action_key: 'farmer_collect',          target_count: 5,  reward_coins: 15, metadata: {}, scale_factors: { t1: 1.0, t2: 1.5, t3: 2.0 } },
        // ── Weekly: WEEKLY_MEDIUM pool (pick 1, scale: t1=1.0 t2=1.5 t3=2.5) ─
        { title: 'PvP Victor',        description: 'Win PvP battles.',                     quest_type: 'weekly', difficulty: 'weekly_medium', category: 'pvp',      action_key: 'pvp_win',              target_count: 2,  reward_coins: 20, metadata: {},                           scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Harvest Master',    description: 'Win harvest dungeon runs.',            quest_type: 'weekly', difficulty: 'weekly_medium', category: 'dungeon',  action_key: 'dungeon_claim_harvest',target_count: 5,  reward_coins: 20, metadata: {},                           scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Animal Caretaker',  description: 'Collect produce from animals.',        quest_type: 'weekly', difficulty: 'weekly_medium', category: 'animal',   action_key: 'animal_collect',       target_count: 5,  reward_coins: 20, metadata: {},                           scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Pinecone Baron',    description: 'Collect pinecone from farmers.',       quest_type: 'weekly', difficulty: 'weekly_medium', category: 'resource', action_key: 'farmer_collect',       target_count: 50, reward_coins: 20, metadata: { resourceType: 'pinecone' }, scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        { title: 'Head Chef',         description: 'Use prepared meals.',                  quest_type: 'weekly', difficulty: 'weekly_medium', category: 'cooking',  action_key: 'kitchen_use',          target_count: 3,  reward_coins: 20, metadata: {},                           scale_factors: { t1: 1.0, t2: 1.5, t3: 2.5 } },
        // ── Weekly: WEEKLY_HARD pool (pick 2, scale: t1=1.0 t2=2.0 t3=3.0) ───
        { title: 'PvP Champion',        description: 'Win PvP battles.',                     quest_type: 'weekly', difficulty: 'weekly_hard', category: 'pvp',      action_key: 'pvp_win',                 target_count: 5,  reward_coins: 25, metadata: {},                              scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Archer Duelist',      description: 'Win PvP battles with an Archer.',      quest_type: 'weekly', difficulty: 'weekly_hard', category: 'pvp',      action_key: 'pvp_win',                 target_count: 2,  reward_coins: 25, metadata: { championClass: 'Archer'  },  scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Warrior Duelist',     description: 'Win PvP battles with a Warrior.',      quest_type: 'weekly', difficulty: 'weekly_hard', category: 'pvp',      action_key: 'pvp_win',                 target_count: 2,  reward_coins: 25, metadata: { championClass: 'Warrior' },  scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Boss Slayer',         description: 'Defeat a boss stage in Adventure.',    quest_type: 'weekly', difficulty: 'weekly_hard', category: 'dungeon',  action_key: 'dungeon_claim_adventure', target_count: 1,  reward_coins: 25, metadata: { isBoss: true },              scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Three Star Run',      description: 'Get 3 stars in an adventure dungeon.', quest_type: 'weekly', difficulty: 'weekly_hard', category: 'dungeon',  action_key: 'dungeon_claim_adventure', target_count: 1,  reward_coins: 25, metadata: { minStars: 3 },               scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Deep Dungeon',        description: 'Win harvest dungeon runs.',             quest_type: 'weekly', difficulty: 'weekly_hard', category: 'dungeon',  action_key: 'dungeon_claim_harvest',   target_count: 10, reward_coins: 25, metadata: {},                              scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Egg Producer',        description: 'Collect eggs from chickens.',           quest_type: 'weekly', difficulty: 'weekly_hard', category: 'animal',   action_key: 'animal_collect',          target_count: 15, reward_coins: 25, metadata: { resourceType: 'egg'  },      scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Wool Producer',       description: 'Collect wool from sheep.',              quest_type: 'weekly', difficulty: 'weekly_hard', category: 'animal',   action_key: 'animal_collect',          target_count: 15, reward_coins: 25, metadata: { resourceType: 'wool' },      scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
        { title: 'Upgrade Enthusiast',  description: 'Upgrade any farmer or animal.',         quest_type: 'weekly', difficulty: 'weekly_hard', category: 'upgrade',  action_key: 'any_upgrade',             target_count: 3,  reward_coins: 25, metadata: {},                              scale_factors: { t1: 1.0, t2: 2.0, t3: 3.0 } },
      ];

      for (const q of quests) {
        await query(
          `INSERT INTO quest_definitions
             (title, description, quest_type, difficulty, category, action_key, target_count, reward_coins, metadata, scale_factors)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
          [q.title, q.description, q.quest_type, q.difficulty, q.category, q.action_key, q.target_count, q.reward_coins, JSON.stringify(q.metadata), JSON.stringify(q.scale_factors)]
        );
      }
      console.log(`Seeded ${quests.length} quest definitions`);
    } else {
      console.log('Quest definitions already seeded. Skipping.');
    }

    // ── Gear definitions (idempotent) ─────────────────────────────────────────
    const gearDefs = [
      // Warrior weapons
      { id: 'iron_sword',    name: 'Iron Sword',    gear_type: 'weapon', class_restriction: 'Warrior', tier: 1, base_attack: 5,  atk_increment: 2, base_defense: 0, def_increment: 0, base_chance: 0, chance_increment: 0, emoji: '⚔️' },
      { id: 'steel_axe',     name: 'Steel Axe',     gear_type: 'weapon', class_restriction: 'Warrior', tier: 2, base_attack: 8,  atk_increment: 3, base_defense: 2, def_increment: 1, base_chance: 0, chance_increment: 0, emoji: '🪓' },
      { id: 'battle_blade',  name: 'Battle Blade',  gear_type: 'weapon', class_restriction: 'Warrior', tier: 3, base_attack: 12, atk_increment: 5, base_defense: 4, def_increment: 2, base_chance: 0, chance_increment: 0, emoji: '🗡️' },
      // Mage weapons
      { id: 'oak_staff',     name: 'Oak Staff',     gear_type: 'weapon', class_restriction: 'Mage',    tier: 1, base_attack: 5,  atk_increment: 2, base_defense: 0, def_increment: 0, base_chance: 3, chance_increment: 1, emoji: '🪄' },
      { id: 'crystal_staff', name: 'Crystal Staff', gear_type: 'weapon', class_restriction: 'Mage',    tier: 2, base_attack: 8,  atk_increment: 3, base_defense: 0, def_increment: 0, base_chance: 5, chance_increment: 2, emoji: '🔮' },
      { id: 'arcane_orb',    name: 'Arcane Orb',    gear_type: 'weapon', class_restriction: 'Mage',    tier: 3, base_attack: 12, atk_increment: 5, base_defense: 0, def_increment: 0, base_chance: 8, chance_increment: 3, emoji: '🌟' },
      // Archer weapons
      { id: 'pine_bow',      name: 'Pine Bow',      gear_type: 'weapon', class_restriction: 'Archer',  tier: 1, base_attack: 5,  atk_increment: 2, base_defense: 0, def_increment: 0, base_chance: 3, chance_increment: 1, emoji: '🏹' },
      { id: 'hunter_bow',    name: 'Hunter Bow',    gear_type: 'weapon', class_restriction: 'Archer',  tier: 2, base_attack: 8,  atk_increment: 3, base_defense: 0, def_increment: 0, base_chance: 5, chance_increment: 2, emoji: '🎯' },
      { id: 'shadow_bow',    name: 'Shadow Bow',    gear_type: 'weapon', class_restriction: 'Archer',  tier: 3, base_attack: 12, atk_increment: 5, base_defense: 0, def_increment: 0, base_chance: 8, chance_increment: 3, emoji: '🌙' },
      // Universal charms
      { id: 'forest_charm',  name: 'Forest Charm',  gear_type: 'charm',  class_restriction: null,      tier: 1, base_attack: 0,  atk_increment: 0, base_defense: 4, def_increment: 2, base_chance: 0, chance_increment: 0, emoji: '🍀' },
      { id: 'silver_charm',  name: 'Silver Charm',  gear_type: 'charm',  class_restriction: null,      tier: 2, base_attack: 0,  atk_increment: 0, base_defense: 7, def_increment: 3, base_chance: 3, chance_increment: 1, emoji: '🪙' },
      { id: 'dragon_charm',  name: 'Dragon Charm',  gear_type: 'charm',  class_restriction: null,      tier: 3, base_attack: 0,  atk_increment: 0, base_defense: 10, def_increment: 4, base_chance: 6, chance_increment: 2, emoji: '🐉' },
    ];
    for (const g of gearDefs) {
      await query(
        `INSERT INTO gear_definitions (id, name, gear_type, class_restriction, tier, base_attack, base_defense, base_chance, atk_increment, def_increment, chance_increment, emoji)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [g.id, g.name, g.gear_type, g.class_restriction, g.tier, g.base_attack, g.base_defense, g.base_chance, g.atk_increment, g.def_increment, g.chance_increment, g.emoji]
      );
    }
    console.log('Seeded gear definitions');

    // ── Forge stone recipes (idempotent) ──────────────────────────────────────
    const forgeStones = [
      { name: 'Forge Stone',        tier: 1, cook: 5,  ingr: { pinecone: 5,  blueberry: 3 },                                  gear_upgrade_tier: 1 },
      { name: 'Fine Forge Stone',   tier: 2, cook: 15, ingr: { pinecone: 10, blueberry: 8, egg: 2 },                          gear_upgrade_tier: 2 },
      { name: 'Master Forge Stone', tier: 3, cook: 30, ingr: { pinecone: 20, blueberry: 15, egg: 5, wool: 3 },                gear_upgrade_tier: 3 },
    ];
    for (const s of forgeStones) {
      const existing = await query(`SELECT id FROM recipes WHERE name = $1`, [s.name]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier, gear_upgrade_tier)
           VALUES ($1, 'gear', 'gear_upgrade', 1, NULL, $2, $3::jsonb, $4, $5)`,
          [s.name, s.cook, JSON.stringify(s.ingr), s.tier, s.gear_upgrade_tier]
        );
      }
    }
    console.log('Seeded forge stone recipes');

    console.log('\nSeed complete! Login with test@test.com / password123');
  } catch (err) {
    console.error('Seed failed:', err);
  }
  process.exit(0);
}

seed();
