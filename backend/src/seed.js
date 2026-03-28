require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('./db');

async function seed() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    const existing = await query('SELECT id FROM players WHERE email = $1', ['test@test.com']);
    if (existing.length > 0) {
      console.log('Test player already exists. Skipping seed.');
      process.exit(0);
    }

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

    console.log('\nSeed complete! Login with test@test.com / password123');
  } catch (err) {
    console.error('Seed failed:', err);
  }
  process.exit(0);
}

seed();
