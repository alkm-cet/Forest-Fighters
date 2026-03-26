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

    console.log('\nSeed complete! Login with test@test.com / password123');
  } catch (err) {
    console.error('Seed failed:', err);
  }
  process.exit(0);
}

seed();
