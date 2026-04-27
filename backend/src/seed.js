require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('./db');
const { STARTER_CHAMPIONS, BOT_PLAYERS, QUEST_DEFINITIONS, GEAR_DEFINITIONS, FORGE_STONES, ADVENTURE_STAGES } = require('./data');
const { getLocalizedField } = require('./data/helpers/i18n');

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

      for (const c of STARTER_CHAMPIONS) {
        const cName = getLocalizedField(c.name, 'en');
        await query(
          'INSERT INTO champions (player_id, name, class) VALUES ($1, $2, $3)',
          [playerId, cName, c.class]
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
    // Stages 1-5 use stage-specific reward resources not captured in ADVENTURE_STAGES,
    // so they are kept inline here. migrate.js handles stages 6+ and all dungeon_type/stage_number fields.
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
    // Per-bot idempotency: check by email so new bots can be added without
    // skipping the whole block when earlier bots already exist.
    const botHash = await bcrypt.hash('botpassword_never_used', 10);
    let botsAdded = 0;

    for (const bot of BOT_PLAYERS) {
      const exists = await query('SELECT id FROM players WHERE email = $1', [bot.email]);
      if (exists.length > 0) {
        console.log(`Bot ${bot.email} already seeded. Skipping.`);
        continue;
      }

      const botUsername = getLocalizedField(bot.username, 'en');
      const botRow = await query(
        `INSERT INTO players (username, email, password_hash, trophies, is_bot) VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
        [botUsername, bot.email, botHash, bot.trophies]
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
        const champName = getLocalizedField(c.name, 'en');
        const cRow = await query(
          `INSERT INTO champions (player_id, name, class, attack, defense, chance, max_hp, current_hp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [botId, champName, c.class,
           c.attack ?? 10, c.defense ?? 10, c.chance ?? 10,
           c.max_hp ?? 100, c.max_hp ?? 100]
        );
        champIds.push(cRow[0].id);
      }

      await query('UPDATE players SET defender_champion_id = $1 WHERE id = $2', [champIds[bot.defIdx], botId]);
      botsAdded++;
    }

    if (botsAdded > 0) console.log(`Added ${botsAdded} new bot player(s) for PvP`);

    // ── Quest definitions (idempotent) ────────────────────────────────────────
    const questCheck = await query('SELECT 1 FROM quest_definitions LIMIT 1');
    if (questCheck.length === 0) {
      for (const q of QUEST_DEFINITIONS) {
        const qTitle = getLocalizedField(q.title, 'en');
        const qDesc  = getLocalizedField(q.description, 'en');
        await query(
          `INSERT INTO quest_definitions
             (title, description, quest_type, difficulty, category, action_key, target_count, reward_coins, metadata, scale_factors)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
          [qTitle, qDesc, q.quest_type, q.difficulty, q.category, q.action_key, q.target_count, q.reward_coins, JSON.stringify(q.metadata), JSON.stringify(q.scale_factors)]
        );
      }
      console.log(`Seeded ${QUEST_DEFINITIONS.length} quest definitions`);
    } else {
      console.log('Quest definitions already seeded. Skipping.');
    }

    // ── Gear definitions (idempotent) ─────────────────────────────────────────
    for (const g of GEAR_DEFINITIONS) {
      const gName = getLocalizedField(g.name, 'en');
      await query(
        `INSERT INTO gear_definitions (id, name, gear_type, class_restriction, tier, base_attack, base_defense, base_chance, atk_increment, def_increment, chance_increment, emoji)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [g.id, gName, g.gear_type, g.class_restriction, g.tier, g.base_attack, g.base_defense, g.base_chance, g.atk_increment, g.def_increment, g.chance_increment, g.emoji]
      );
    }
    console.log('Seeded gear definitions');

    // ── Forge stone recipes (idempotent) ──────────────────────────────────────
    for (const s of FORGE_STONES) {
      const sName = getLocalizedField(s.name, 'en');
      const existing = await query(`SELECT id FROM recipes WHERE name = $1`, [sName]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier, gear_upgrade_tier)
           VALUES ($1, 'gear', 'gear_upgrade', 1, NULL, $2, $3::jsonb, $4, $5)`,
          [sName, s.cook, JSON.stringify(s.ingr), s.tier, s.gear_upgrade_tier]
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
