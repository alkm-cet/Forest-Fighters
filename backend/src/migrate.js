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

    await query(`
      CREATE TABLE IF NOT EXISTS dungeons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        enemy_name VARCHAR(100) NOT NULL,
        enemy_attack INT NOT NULL,
        enemy_defense INT NOT NULL,
        enemy_chance INT NOT NULL,
        enemy_hp INT NOT NULL,
        duration_minutes INT NOT NULL,
        reward_resource VARCHAR(50) NOT NULL,
        reward_amount INT NOT NULL
      )
    `);
    console.log('Created table: dungeons');

    await query(`
      CREATE TABLE IF NOT EXISTS dungeon_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        champion_id UUID REFERENCES champions(id),
        dungeon_id UUID REFERENCES dungeons(id),
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ends_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        winner VARCHAR(20),
        battle_log JSONB,
        reward_resource VARCHAR(50),
        reward_amount INT
      )
    `);
    console.log('Created table: dungeon_runs');

    // Ensure is_deployed column exists on champions
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS is_deployed BOOLEAN DEFAULT FALSE`);

    // XP / leveling system
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0`);
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS xp_to_next_level INT DEFAULT 100`);

    // Stat points (earned each level-up, spent on attack/defense/chance)
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS stat_points INT DEFAULT 0`);

    // Resource storage caps (player can hold up to cap of each resource)
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS strawberry_cap INT DEFAULT 10`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS pinecone_cap INT DEFAULT 10`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS blueberry_cap INT DEFAULT 10`);
    // Reset existing caps to new starting value (dev reset)
    await query(`UPDATE player_resources SET strawberry_cap = 10 WHERE strawberry_cap = 15`);
    await query(`UPDATE player_resources SET pinecone_cap   = 10 WHERE pinecone_cap   = 15`);
    await query(`UPDATE player_resources SET blueberry_cap  = 10 WHERE blueberry_cap  = 15`);

    // Combat boosts (cleared after each battle)
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS boost_hp INT DEFAULT 0`);
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS boost_defense INT DEFAULT 0`);
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS boost_chance INT DEFAULT 0`);

    // XP reward per dungeon
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS xp_reward INT DEFAULT 20`);

    // Seed xp_reward values for existing dungeons (safe to run multiple times — only updates 0s)
    await query(`UPDATE dungeons SET xp_reward = 10  WHERE name = '[TEST] Quick Cave'   AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 20  WHERE name = 'Whispering Woods'   AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 40  WHERE name = 'Mossy Ruins'        AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 60  WHERE name = 'Troll Bridge'       AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 80  WHERE name = 'Orcish Camp'        AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 120 WHERE name = 'Dark Sanctum'       AND xp_reward = 20`);

    // ── PvP system ──────────────────────────────────────────────────────────────

    // players: trophy & defender columns
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS trophies INT DEFAULT 10`);
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS defender_champion_id UUID REFERENCES champions(id)`);
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS defense_shield_until TIMESTAMPTZ`);
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE`);

    // champions: last_defender flag
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS last_defender BOOLEAN DEFAULT FALSE`);

    // players: pvp_unlocked — true when player has at least one level 3+ champion
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS pvp_unlocked BOOLEAN DEFAULT FALSE`);
    // Backfill for existing players who already have a level 3+ champion
    await query(`
      UPDATE players p SET pvp_unlocked = TRUE
      WHERE EXISTS (
        SELECT 1 FROM champions c WHERE c.player_id = p.id AND c.level >= 3
      )
    `);

    // pvp_battles: new columns
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS result_available_at TIMESTAMPTZ`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS attacker_trophies_delta INT DEFAULT 0`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS defender_trophies_delta INT DEFAULT 0`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS transferred_strawberry INT DEFAULT 0`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS transferred_pinecone INT DEFAULT 0`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS transferred_blueberry INT DEFAULT 0`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS seen_by_attacker BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS seen_by_defender BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS combat_log JSONB`);
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS revenge_used BOOLEAN DEFAULT FALSE`);

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
