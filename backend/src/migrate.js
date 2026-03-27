require('dotenv').config();
const { query } = require('./db');

async function migrate() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: players');

    await query(`
      CREATE TABLE IF NOT EXISTS player_resources (
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        strawberry INT DEFAULT 0,
        pinecone INT DEFAULT 0,
        blueberry INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (player_id)
      )
    `);
    console.log('Created table: player_resources');

    await query(`
      CREATE TABLE IF NOT EXISTS champions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        class VARCHAR(50) NOT NULL,
        level INT DEFAULT 1,
        attack INT DEFAULT 10,
        defense INT DEFAULT 10,
        chance INT DEFAULT 10,
        max_hp INT DEFAULT 100,
        current_hp INT DEFAULT 100,
        is_deployed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: champions');

    // Add hp columns to existing champions table if not present
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS max_hp INT DEFAULT 100`);
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS current_hp INT DEFAULT 100`);

    await query(`
      CREATE TABLE IF NOT EXISTS farmers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        production_rate INT DEFAULT 5,
        level INT DEFAULT 1,
        last_collected_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: farmers');

    await query(`
      CREATE TABLE IF NOT EXISTS missions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        champion_id UUID REFERENCES champions(id),
        dungeon_name VARCHAR(100) NOT NULL,
        duration_minutes INT NOT NULL,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        reward_claimed BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'active'
      )
    `);
    console.log('Created table: missions');

    await query(`
      CREATE TABLE IF NOT EXISTS pvp_battles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attacker_id UUID REFERENCES players(id),
        defender_id UUID REFERENCES players(id),
        attacker_champion_id UUID REFERENCES champions(id),
        defender_champion_id UUID REFERENCES champions(id),
        winner_id UUID REFERENCES players(id),
        battle_log JSONB,
        fought_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: pvp_battles');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
