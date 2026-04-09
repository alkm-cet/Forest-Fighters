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

    // duration_seconds — allows sub-minute dungeon durations (overrides duration_minutes when set)
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS duration_seconds INT`);

    // Seed xp_reward values for existing dungeons (safe to run multiple times — only updates 0s)
    await query(`UPDATE dungeons SET xp_reward = 10  WHERE name = '[TEST] Quick Cave'      AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 5   WHERE name = '[TEST] Quick Cave 30s'  AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 20  WHERE name = 'Whispering Woods'       AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 40  WHERE name = 'Mossy Ruins'            AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 60  WHERE name = 'Troll Bridge'           AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 80  WHERE name = 'Orcish Camp'            AND xp_reward = 20`);
    await query(`UPDATE dungeons SET xp_reward = 120 WHERE name = 'Dark Sanctum'           AND xp_reward = 20`);

    // Insert [TEST] Quick Cave 30s — idempotent
    await query(`
      INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp, duration_minutes, duration_seconds, reward_resource, reward_amount, xp_reward)
      SELECT '[TEST] Quick Cave 30s', 'A brutal 30-second test run. Good luck.', 'Troll',
             40, 30, 50, 250,
             0, 30,
             'pinecone', 5, 5
      WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = '[TEST] Quick Cave 30s')
    `);

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

    // pvp_storage — loot pool for PvP (separate from spendable resources)
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS pvp_storage_strawberry INT DEFAULT 0`);
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS pvp_storage_pinecone    INT DEFAULT 0`);
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS pvp_storage_blueberry   INT DEFAULT 0`);
    // Backfill bots: seed their pvp_storage from their current player_resources so they have lootable resources
    await query(`
      UPDATE players p SET
        pvp_storage_strawberry = LEAST(COALESCE(pr.strawberry, 30), 500),
        pvp_storage_pinecone   = LEAST(COALESCE(pr.pinecone,   30), 500),
        pvp_storage_blueberry  = LEAST(COALESCE(pr.blueberry,  30), 500)
      FROM player_resources pr
      WHERE pr.player_id = p.id
        AND p.is_bot = TRUE
        AND p.pvp_storage_strawberry = 0
        AND p.pvp_storage_pinecone   = 0
        AND p.pvp_storage_blueberry  = 0
    `);

    // ── Animals system ──────────────────────────────────────────────────────────
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS egg  INT DEFAULT 0`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS wool INT DEFAULT 0`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS milk INT DEFAULT 0`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS egg_cap  INT DEFAULT 10`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS wool_cap INT DEFAULT 10`);
    await query(`ALTER TABLE player_resources ADD COLUMN IF NOT EXISTS milk_cap INT DEFAULT 10`);

    await query(`
      CREATE TABLE IF NOT EXISTS player_animals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        animal_type VARCHAR(20) NOT NULL,
        level INT DEFAULT 1,
        current_feed INT DEFAULT 0,
        max_feed INT DEFAULT 30,
        last_production_time TIMESTAMP DEFAULT NOW()
      )
    `);
    // New fuel-based animal columns
    await query(`ALTER TABLE player_animals ADD COLUMN IF NOT EXISTS fuel_remaining_minutes FLOAT DEFAULT 0`);
    await query(`ALTER TABLE player_animals ADD COLUMN IF NOT EXISTS progress_minutes FLOAT DEFAULT 0`);
    await query(`ALTER TABLE player_animals ADD COLUMN IF NOT EXISTS pending_production INT DEFAULT 0`);
    await query(`ALTER TABLE player_animals ADD COLUMN IF NOT EXISTS last_computed_at TIMESTAMP DEFAULT NOW()`);

    // last_computed_ms: Unix timestamp in milliseconds (BIGINT) — replaces last_computed_at.
    // Using a plain number eliminates all TIMESTAMP/TIMESTAMPTZ format and timezone parsing issues.
    await query(`ALTER TABLE player_animals ADD COLUMN IF NOT EXISTS last_computed_ms BIGINT DEFAULT 0`);
    // Backfill from last_computed_at (treat bare TIMESTAMP as UTC, multiply to ms)
    await query(`
      UPDATE player_animals
         SET last_computed_ms = EXTRACT(EPOCH FROM last_computed_at AT TIME ZONE 'UTC') * 1000
       WHERE last_computed_ms = 0 AND last_computed_at IS NOT NULL
    `);
    console.log('Animals system migrated');

    // ── Farm system ─────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS player_farms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        farm_type VARCHAR(20) NOT NULL,
        level INT DEFAULT 1,
        UNIQUE(player_id, farm_type)
      )
    `);
    await query(`ALTER TABLE player_animals ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES player_farms(id)`);
    console.log('Farm system migrated');

    // ── In-game coin system ─────────────────────────────────────────────────
    await query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS coins INT DEFAULT 0`);
    console.log('Coins column added to players');

    // ── Dungeon System v2 ────────────────────────────────────────────────────
    // Extend dungeons table with type-specific columns
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS dungeon_type VARCHAR(20) DEFAULT 'adventure'`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS cooldown_minutes INT DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS daily_run_limit INT DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS stage_number INT DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS is_boss_stage BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS coin_reward INT DEFAULT 0`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS reward_resource_2 VARCHAR(50) DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS reward_amount_2 INT DEFAULT 0`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS event_starts_at TIMESTAMPTZ DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS event_ends_at TIMESTAMPTZ DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS reward_multiplier FLOAT DEFAULT 1.0`);

    // Extend dungeon_runs table
    await query(`ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS stars_earned INT DEFAULT NULL`);

    // Reclassify existing 5 dungeons as adventure stages 1-5 (idempotent: only when stage_number is NULL)
    await query(`
      UPDATE dungeons SET dungeon_type = 'adventure',
        stage_number = CASE name
          WHEN 'Whispering Woods' THEN 1
          WHEN 'Mossy Ruins'      THEN 2
          WHEN 'Troll Bridge'     THEN 3
          WHEN 'Orcish Camp'      THEN 4
          WHEN 'Dark Sanctum'     THEN 5
        END,
        is_boss_stage = CASE name WHEN 'Dark Sanctum' THEN TRUE ELSE FALSE END
      WHERE name IN ('Whispering Woods','Mossy Ruins','Troll Bridge','Orcish Camp','Dark Sanctum')
        AND stage_number IS NULL
    `);

    // New tables for dungeon v2
    await query(`
      CREATE TABLE IF NOT EXISTS adventure_progress (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id  UUID REFERENCES players(id) ON DELETE CASCADE,
        dungeon_id UUID REFERENCES dungeons(id),
        best_stars INT NOT NULL DEFAULT 0,
        cleared_at TIMESTAMPTZ DEFAULT NULL,
        UNIQUE (player_id, dungeon_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS harvest_cooldowns (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id    UUID REFERENCES players(id) ON DELETE CASCADE,
        dungeon_id   UUID REFERENCES dungeons(id),
        last_run_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        runs_today   INT NOT NULL DEFAULT 1,
        day_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
        UNIQUE (player_id, dungeon_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS adventure_star_milestones (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        required_stars  INT NOT NULL UNIQUE,
        reward_coins    INT NOT NULL DEFAULT 0,
        reward_resource VARCHAR(50) DEFAULT NULL,
        reward_amount   INT DEFAULT 0,
        label           VARCHAR(100)
      )
    `);
    await query(`
      INSERT INTO adventure_star_milestones (required_stars, reward_coins, label)
      VALUES (10, 50, 'First Explorer'), (25, 150, 'Dungeon Delver'), (45, 300, 'Champion')
      ON CONFLICT (required_stars) DO NOTHING
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS adventure_milestone_claims (
        player_id      UUID REFERENCES players(id) ON DELETE CASCADE,
        required_stars INT NOT NULL,
        claimed_at     TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (player_id, required_stars)
      )
    `);

    // Seed harvest dungeons (idempotent)
    const harvestDungeons = [
      { name: 'Berry Cave', desc: 'A cozy cave filled with wild berries.', enemy: 'Chipmunk', atk: 6, def: 3, chc: 10, hp: 50, dur: 15, res: 'strawberry', amt: 6, res2: 'pinecone', amt2: 4, cooldown: 30, limit: null },
      { name: 'Chicken Nest', desc: 'A fox guards a hidden nest of eggs.', enemy: 'Fox', atk: 10, def: 6, chc: 15, hp: 65, dur: 20, res: 'egg', amt: 8, res2: null, amt2: 0, cooldown: 60, limit: 3 },
      { name: 'Sheep Meadow', desc: 'A peaceful meadow where wolves prowl.', enemy: 'Wolf', atk: 14, def: 8, chc: 12, hp: 80, dur: 25, res: 'wool', amt: 8, res2: null, amt2: 0, cooldown: 60, limit: 3 },
      { name: 'Golden Farm', desc: 'A prosperous farm guarded by bandits.', enemy: 'Bandit', atk: 20, def: 14, chc: 20, hp: 90, dur: 30, res: 'milk', amt: 5, res2: 'egg', amt2: 5, cooldown: 120, limit: 2 },
    ];
    for (const d of harvestDungeons) {
      await query(`
        INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
          duration_minutes, reward_resource, reward_amount, reward_resource_2, reward_amount_2,
          dungeon_type, cooldown_minutes, daily_run_limit, xp_reward)
        SELECT $1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT,
               $8::INT, $9::VARCHAR, $10::INT, $11::VARCHAR, $12::INT, 'harvest', $13::INT, $14::INT, 0
        WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = $1::VARCHAR)
      `, [d.name, d.desc, d.enemy, d.atk, d.def, d.chc, d.hp, d.dur, d.res, d.amt, d.res2 ?? null, d.amt2, d.cooldown, d.limit ?? null]);
    }

    // Seed adventure stages 6-15 (idempotent)
    const adventureStages = [
      { stage: 6,  name: 'Fungal Cavern',     desc: 'Mushrooms sprout from the walls of this damp cavern.', enemy: 'Mushroom Golem', atk: 30, def: 18, chc: 15, hp: 120, dur: 35, coins: 15, xp: 130, boss: false },
      { stage: 7,  name: 'Bandit Hideout',    desc: 'A network of tunnels used by forest bandits.', enemy: 'Bandit Chief', atk: 32, def: 20, chc: 22, hp: 125, dur: 35, coins: 15, xp: 140, boss: false },
      { stage: 8,  name: 'Frozen Tundra',     desc: 'A frozen wasteland where an ice witch lurks.', enemy: 'Ice Witch', atk: 34, def: 16, chc: 30, hp: 110, dur: 40, coins: 20, xp: 150, boss: false },
      { stage: 9,  name: 'Lava Fields',       desc: 'Volcanic fields that burn with ancient fire.', enemy: 'Fire Imp', atk: 36, def: 22, chc: 18, hp: 130, dur: 40, coins: 20, xp: 160, boss: false },
      { stage: 10, name: 'Magma Fortress',    desc: 'A fortress forged from volcanic rock, home to a mighty titan.', enemy: 'Lava Titan', atk: 44, def: 30, chc: 25, hp: 180, dur: 50, coins: 40, xp: 200, boss: true },
      { stage: 11, name: 'Haunted Graveyard', desc: 'Ancient tombstones hide a wailing banshee.', enemy: 'Banshee', atk: 40, def: 18, chc: 40, hp: 130, dur: 50, coins: 25, xp: 210, boss: false },
      { stage: 12, name: 'Shadow Realm',      desc: 'A realm of darkness where shadows take form.', enemy: 'Shadow Knight', atk: 44, def: 28, chc: 28, hp: 145, dur: 55, coins: 25, xp: 220, boss: false },
      { stage: 13, name: 'Ancient Tomb',      desc: 'A buried tomb where an ancient mummy slumbers.', enemy: 'Mummy Lord', atk: 46, def: 32, chc: 22, hp: 155, dur: 55, coins: 30, xp: 230, boss: false },
      { stage: 14, name: 'Dragon Lair',       desc: 'A mountain cave where a fearsome wyvern nests.', enemy: 'Wyvern', atk: 50, def: 28, chc: 32, hp: 160, dur: 60, coins: 30, xp: 240, boss: false },
      { stage: 15, name: 'Void Gate',         desc: 'A tear in reality guarded by an ancient void lich.', enemy: 'Void Lich', atk: 60, def: 35, chc: 45, hp: 200, dur: 60, coins: 60, xp: 300, boss: true },
    ];
    for (const s of adventureStages) {
      await query(`
        INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
          duration_minutes, reward_resource, reward_amount, dungeon_type, stage_number, is_boss_stage, coin_reward, xp_reward)
        SELECT $1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT,
               $8::INT, 'pinecone', 5, 'adventure', $9::INT, $10::BOOLEAN, $11::INT, $12::INT
        WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = $1::VARCHAR)
      `, [s.name, s.desc, s.enemy, s.atk, s.def, s.chc, s.hp, s.dur, s.stage, s.boss, s.coins, s.xp]);
    }

    // Seed event dungeon (idempotent)
    await query(`
      INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
        duration_minutes, reward_resource, reward_amount, dungeon_type, event_starts_at, event_ends_at, reward_multiplier, xp_reward)
      SELECT 'Harvest Festival', 'A festive dungeon with double rewards! Limited time only.', 'Party Goblin',
             10, 5, 20, 70, 10, 'strawberry', 10, 'event', NOW(), NOW() + INTERVAL '7 days', 2.0, 30
      WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = 'Harvest Festival')
    `);

    console.log('Dungeon System v2 migrated');
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
