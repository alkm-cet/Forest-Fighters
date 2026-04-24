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
    await query(`ALTER TABLE champions ADD COLUMN IF NOT EXISTS boost_attack INT DEFAULT 0`);

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
    await query(`ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS gear_snapshot JSONB`);

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
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS min_champion_level INT DEFAULT NULL`);
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS extra_rewards JSONB DEFAULT '[]'`);

    // Extend dungeon_runs table
    await query(`ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS stars_earned INT DEFAULT NULL`);

    // Force-correct stage numbers for the original 5 adventure dungeons (always runs — idempotent)
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

    // Unique index on dungeon name — required for the upsert below
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS dungeons_name_unique ON dungeons(name)`);

    // Seed harvest dungeons — this array is the single source of truth.
    // ON CONFLICT DO UPDATE ensures the DB always matches these definitions.
    // duration_seconds is explicitly kept NULL for harvest dungeons.
    const harvestDungeons = [
      // ── Tier 1 — Easy (no level requirement) ─────────────────────────────────
      { name: 'Berry Cave',         desc: 'A cozy cave filled with wild berries.',          enemy: 'Chipmunk',    atk: 6,  def: 3,  chc: 10, hp: 50,  dur: 15, res: 'strawberry', amt: 6,  res2: 'pinecone',    amt2: 4,  cooldown: 30,  limit: null, minLv: null, extra: [] },
      { name: 'Pine Grove',         desc: 'Squirrels hoard pinecones in this quiet grove.',  enemy: 'Squirrel',    atk: 8,  def: 4,  chc: 10, hp: 55,  dur: 15, res: 'pinecone',   amt: 10, res2: null,          amt2: 0,  cooldown: 30,  limit: null, minLv: null, extra: [] },
      { name: 'Blueberry Fields',   desc: 'Rolling fields thick with blueberry bushes.',     enemy: 'Rabbit',      atk: 7,  def: 3,  chc: 12, hp: 50,  dur: 15, res: 'blueberry',  amt: 8,  res2: null,          amt2: 0,  cooldown: 30,  limit: null, minLv: null, extra: [] },
      { name: 'Strawberry Garden',  desc: 'A hidden garden overflowing with strawberries.',  enemy: 'Chipmunk',    atk: 9,  def: 5,  chc: 10, hp: 60,  dur: 20, res: 'strawberry', amt: 14, res2: null,          amt2: 0,  cooldown: 45,  limit: 4,    minLv: null, extra: [] },
      // ── Tier 2 — Medium (no level requirement) ───────────────────────────────
      { name: 'Chicken Nest',       desc: 'A fox guards a hidden nest of eggs.',             enemy: 'Fox',         atk: 10, def: 6,  chc: 15, hp: 65,  dur: 20, res: 'egg',        amt: 8,  res2: null,          amt2: 0,  cooldown: 60,  limit: 3,    minLv: null, extra: [] },
      { name: 'Egg Ranch',          desc: 'A busy fox-guarded ranch full of egg-layers.',    enemy: 'Fox',         atk: 13, def: 8,  chc: 15, hp: 75,  dur: 20, res: 'egg',        amt: 14, res2: null,          amt2: 0,  cooldown: 60,  limit: 3,    minLv: null, extra: [] },
      { name: 'Sheep Meadow',       desc: 'A peaceful meadow where wolves prowl.',           enemy: 'Wolf',        atk: 14, def: 8,  chc: 12, hp: 80,  dur: 25, res: 'wool',       amt: 8,  res2: null,          amt2: 0,  cooldown: 60,  limit: 3,    minLv: null, extra: [] },
      { name: 'Wool Valley',        desc: 'A valley of wandering sheep watched by wolves.',  enemy: 'Wolf',        atk: 16, def: 10, chc: 12, hp: 85,  dur: 25, res: 'wool',       amt: 14, res2: null,          amt2: 0,  cooldown: 75,  limit: 3,    minLv: null, extra: [] },
      { name: 'Milk Meadow',        desc: 'A lush meadow patrolled by a hungry bear.',       enemy: 'Bear',        atk: 18, def: 12, chc: 14, hp: 90,  dur: 25, res: 'milk',       amt: 10, res2: null,          amt2: 0,  cooldown: 90,  limit: 2,    minLv: null, extra: [] },
      { name: 'Berry Twin',         desc: 'Two berry patches guarded by a cunning fox.',     enemy: 'Fox',         atk: 14, def: 9,  chc: 15, hp: 80,  dur: 25, res: 'strawberry', amt: 10, res2: 'blueberry',   amt2: 8,  cooldown: 60,  limit: 3,    minLv: null, extra: [] },
      { name: 'Forest Bounty',      desc: 'Deep forest brimming with mixed harvests.',       enemy: 'Wolf',        atk: 20, def: 13, chc: 18, hp: 95,  dur: 30, res: 'pinecone',   amt: 12, res2: 'strawberry',  amt2: 8,  cooldown: 90,  limit: 2,    minLv: null, extra: [] },
      { name: 'Cozy Ranch',         desc: 'A cozy ranch guarded by a bear.',                 enemy: 'Bear',        atk: 22, def: 14, chc: 16, hp: 100, dur: 30, res: 'milk',       amt: 8,  res2: 'wool',        amt2: 8,  cooldown: 90,  limit: 2,    minLv: null, extra: [] },
      { name: 'Golden Farm',        desc: 'A prosperous farm guarded by bandits.',           enemy: 'Bandit',      atk: 20, def: 14, chc: 20, hp: 90,  dur: 30, res: 'milk',       amt: 5,  res2: 'egg',         amt2: 5,  cooldown: 120, limit: 2,    minLv: null, extra: [] },
      // ── Tier 3 — Hard (min_champion_level 5-8) ───────────────────────────────
      { name: 'Ancient Orchard',    desc: 'An orchard guarded by a terrible troll.',         enemy: 'Troll',       atk: 26, def: 16, chc: 20, hp: 115, dur: 30, res: 'egg',        amt: 22, res2: null,          amt2: 0,  cooldown: 120, limit: 2,    minLv: 5,    extra: [] },
      { name: 'Cursed Barn',        desc: 'A barn haunted by restless skeletons.',           enemy: 'Skeleton',    atk: 24, def: 15, chc: 22, hp: 105, dur: 30, res: 'wool',       amt: 20, res2: null,          amt2: 0,  cooldown: 120, limit: 2,    minLv: 5,    extra: [] },
      { name: 'Shadow Pasture',     desc: 'A pasture shrouded in dark magic.',               enemy: 'Dark Mage',   atk: 28, def: 12, chc: 30, hp: 105, dur: 35, res: 'blueberry',  amt: 16, res2: 'wool',        amt2: 10, cooldown: 120, limit: 2,    minLv: 6,    extra: [] },
      { name: 'Dragon Dairy',       desc: 'An orc clan has seized this dairy farm.',         enemy: 'Orc',         atk: 30, def: 18, chc: 22, hp: 125, dur: 35, res: 'milk',       amt: 14, res2: 'egg',         amt2: 10, cooldown: 150, limit: 1,    minLv: 7,    extra: [] },
      { name: 'Haunted Vineyard',   desc: 'A skeleton-infested vineyard of rare berries.',   enemy: 'Skeleton',    atk: 32, def: 16, chc: 25, hp: 120, dur: 35, res: 'strawberry', amt: 18, res2: 'blueberry',   amt2: 14, cooldown: 150, limit: 1,    minLv: 8,    extra: [] },
      // ── Tier 4 — Very Hard (min_champion_level 9-12) ─────────────────────────
      { name: 'Crystal Cave',       desc: 'A crystal-lined cave hoarded by orcs.',           enemy: 'Orc',         atk: 34, def: 20, chc: 25, hp: 140, dur: 40, res: 'pinecone',   amt: 22, res2: 'blueberry',   amt2: 12, cooldown: 180, limit: 1,    minLv: 9,    extra: [] },
      { name: "Giant's Farm",       desc: 'A giant troll rules this massive farm.',          enemy: 'Troll',       atk: 36, def: 22, chc: 18, hp: 155, dur: 40, res: 'milk',       amt: 22, res2: null,          amt2: 0,  cooldown: 180, limit: 1,    minLv: 9,    extra: [] },
      { name: 'Rainbow Harvest',    desc: 'A rainbow bounty guarded by orc warlords.',       enemy: 'Orc',         atk: 32, def: 19, chc: 24, hp: 135, dur: 40, res: 'egg',        amt: 10, res2: 'wool',        amt2: 10, cooldown: 180, limit: 1,    minLv: 10,   extra: [{resource:'blueberry',amount:8},{resource:'milk',amount:8}] },
      { name: "Elder's Grove",      desc: 'An ancient grove guarded by a dark mage.',        enemy: 'Dark Mage',   atk: 38, def: 20, chc: 35, hp: 145, dur: 45, res: 'strawberry', amt: 14, res2: 'pinecone',    amt2: 14, cooldown: 200, limit: 1,    minLv: 12,   extra: [] },
      // ── Tier 5 — Legendary (min_champion_level 15) ───────────────────────────
      { name: 'Bountiful Lands',    desc: 'Legendary lands teeming with every resource.',    enemy: 'Bandit Chief', atk: 44, def: 26, chc: 28, hp: 170, dur: 45, res: 'strawberry', amt: 6,  res2: 'pinecone',   amt2: 6,  cooldown: 240, limit: 1,    minLv: 15,   extra: [{resource:'blueberry',amount:6},{resource:'egg',amount:6},{resource:'wool',amount:6},{resource:'milk',amount:6}] },
    ];
    for (const d of harvestDungeons) {
      await query(`
        INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
          duration_minutes, duration_seconds, reward_resource, reward_amount, reward_resource_2, reward_amount_2,
          dungeon_type, cooldown_minutes, daily_run_limit, xp_reward, min_champion_level, extra_rewards)
        VALUES ($1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT,
                $8::INT, NULL, $9::VARCHAR, $10::INT, $11::VARCHAR, $12::INT, 'harvest', $13::INT, $14::INT, 0,
                $15::INT, $16::jsonb)
        ON CONFLICT (name) DO UPDATE SET
          description       = EXCLUDED.description,
          enemy_name        = EXCLUDED.enemy_name,
          enemy_attack      = EXCLUDED.enemy_attack,
          enemy_defense     = EXCLUDED.enemy_defense,
          enemy_chance      = EXCLUDED.enemy_chance,
          enemy_hp          = EXCLUDED.enemy_hp,
          duration_minutes  = EXCLUDED.duration_minutes,
          duration_seconds  = NULL,
          reward_resource   = EXCLUDED.reward_resource,
          reward_amount     = EXCLUDED.reward_amount,
          reward_resource_2 = EXCLUDED.reward_resource_2,
          reward_amount_2   = EXCLUDED.reward_amount_2,
          cooldown_minutes  = EXCLUDED.cooldown_minutes,
          daily_run_limit   = EXCLUDED.daily_run_limit,
          min_champion_level = EXCLUDED.min_champion_level,
          extra_rewards     = EXCLUDED.extra_rewards
      `, [d.name, d.desc, d.enemy, d.atk, d.def, d.chc, d.hp, d.dur, d.res, d.amt, d.res2 ?? null, d.amt2, d.cooldown, d.limit ?? null, d.minLv ?? null, JSON.stringify(d.extra ?? [])]);
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

    // Remove Test Chamber if it exists (was replaced by stage-1 100% drop)
    await query(`DELETE FROM dungeons WHERE name = 'Test Chamber'`);

    // Seed event dungeon (idempotent)
    await query(`
      INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
        duration_minutes, reward_resource, reward_amount, dungeon_type, event_starts_at, event_ends_at, reward_multiplier, xp_reward)
      SELECT 'Harvest Festival', 'A festive dungeon with double rewards! Limited time only.', 'Party Goblin',
             10, 5, 20, 70, 10, 'strawberry', 10, 'event', NOW(), NOW() + INTERVAL '7 days', 2.0, 30
      WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = 'Harvest Festival')
    `);

    console.log('Dungeon System v2 migrated');

    // ── Kitchen System ───────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        target VARCHAR(50) NOT NULL,
        effect_type VARCHAR(50) NOT NULL,
        effect_value INT NOT NULL,
        effect_duration_minutes INT,
        cook_duration_minutes INT NOT NULL DEFAULT 1,
        ingredients JSONB NOT NULL,
        tier INT DEFAULT 1
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS player_food (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        recipe_id UUID REFERENCES recipes(id),
        status VARCHAR(20) DEFAULT 'cooking',
        cooking_started_at TIMESTAMP DEFAULT NOW(),
        cooking_ready_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS active_boosts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        boost_type VARCHAR(50) NOT NULL,
        boost_value INT NOT NULL,
        target VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    // active_boosts: entity_id links boost to a specific champion or farmer
    await query(`ALTER TABLE active_boosts ADD COLUMN IF NOT EXISTS entity_id UUID`);
    // active_boosts: is_one_shot = consumed after a single battle/use
    await query(`ALTER TABLE active_boosts ADD COLUMN IF NOT EXISTS is_one_shot BOOLEAN DEFAULT FALSE`);
    // active_boosts: recipe_id for reconstructing slot display on drawer reopen
    await query(`ALTER TABLE active_boosts ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL`);

    // ── Recipe redesign (v2) ─────────────────────────────────────────────────
    // If 'Ironbark Stew' doesn't exist the new recipes haven't been seeded yet.
    // Reset stale food state and seed the new 11 recipes.
    const ironbarkCheck = await query(`SELECT 1 FROM recipes WHERE name = 'Ironbark Stew' LIMIT 1`);
    if (!ironbarkCheck.length) {
      // Clear stale cooking/boost state so nothing references the old recipe UUIDs
      await query(`DELETE FROM active_boosts`);
      await query(`DELETE FROM player_food`);
      await query(`DELETE FROM recipes`);

      const newRecipes = [
        // T1 — cheap, quick, one-shot fighter boosts + basic farmer buff
        { name: 'Forest Berry Jam',       target: 'fighters',    effect_type: 'boost_hp',         effect_value: 8,  dur: null, cook: 3,  ingr: {strawberry:4, egg:2},              tier: 1 },
        { name: 'Blueberry Mash',         target: 'fighters',    effect_type: 'boost_chance',      effect_value: 5,  dur: null, cook: 3,  ingr: {blueberry:4, egg:2},               tier: 1 },
        { name: 'Pinecone Tea',           target: 'farmers',     effect_type: 'boost_production',  effect_value: 25, dur: 20,   cook: 5,  ingr: {pinecone:4, milk:2},               tier: 1 },
        // T2 — stronger one-shot fighter boosts + farmer/farm_animal buffs
        { name: 'Mixed Berry Pie',        target: 'fighters',    effect_type: 'boost_hp',         effect_value: 14, dur: null, cook: 8,  ingr: {strawberry:8, blueberry:8, egg:4},  tier: 2 },
        { name: 'Egg Forest Rice',        target: 'fighters',    effect_type: 'boost_defense',     effect_value: 8,  dur: null, cook: 8,  ingr: {egg:10, strawberry:6},             tier: 2 },
        { name: 'Pinecone Cake',          target: 'farmers',     effect_type: 'boost_production',  effect_value: 40, dur: 30,   cook: 10, ingr: {pinecone:12, milk:6},              tier: 2 },
        { name: 'Forest Stew',            target: 'farm_animals',effect_type: 'boost_production',  effect_value: 20, dur: 30,   cook: 10, ingr: {strawberry:8, pinecone:8, egg:5},  tier: 2 },
        // T3 — powerful one-shot fighter boosts + long-duration farm_animal buffs
        { name: 'Magic Forest Soup',      target: 'fighters',    effect_type: 'boost_hp',         effect_value: 20, dur: null, cook: 15, ingr: {strawberry:15, blueberry:12, egg:8},         tier: 3 },
        { name: 'Ironbark Stew',          target: 'fighters',    effect_type: 'boost_defense',     effect_value: 14, dur: null, cook: 15, ingr: {egg:12, wool:6, strawberry:8},              tier: 3 },
        { name: 'Dragon Pinecone Delight',target: 'farm_animals',effect_type: 'boost_production',  effect_value: 35, dur: 60,   cook: 20, ingr: {pinecone:20, milk:12, wool:8},              tier: 3 },
        { name: 'Mystic Wool Dessert',    target: 'farm_animals',effect_type: 'boost_capacity',    effect_value: 5,  dur: 45,   cook: 20, ingr: {wool:15, milk:10, blueberry:10},            tier: 3 },
      ];

      for (const r of newRecipes) {
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier)
           VALUES ($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::jsonb, $8::INT)`,
          [r.name, r.target, r.effect_type, r.effect_value, r.dur, r.cook, JSON.stringify(r.ingr), r.tier]
        );
      }
      console.log('Recipes v2 seeded (11 new recipes)');
    }

    // Allow fractional cook times (e.g. 0.5 for 30 seconds — used for test recipes)
    await query(`ALTER TABLE recipes ALTER COLUMN cook_duration_minutes TYPE NUMERIC`);

    // Add 3 new warriors-only timed defense recipes if they don't exist yet
    const warriorBrewCheck = await query(`SELECT 1 FROM recipes WHERE name = 'Forest Warrior Brew' LIMIT 1`);
    if (!warriorBrewCheck.length) {
      const warriorRecipes = [
        // 30s cook (0.5 min) — for quick testing; +10 defense for 30 min
        { name: 'Forest Warrior Brew', target: 'fighters', effect_type: 'boost_defense', effect_value: 10, dur: 30,  cook: 0.5, ingr: { pinecone: 6, egg: 4 },                        tier: 2 },
        // +15 defense for 1 hour
        { name: 'Shield Bark Soup',    target: 'fighters', effect_type: 'boost_defense', effect_value: 15, dur: 60,  cook: 20,  ingr: { pinecone: 12, egg: 8, wool: 5 },              tier: 3 },
        // +20 defense for 2 hours
        { name: 'Titanwood Feast',     target: 'fighters', effect_type: 'boost_defense', effect_value: 20, dur: 120, cook: 35,  ingr: { pinecone: 20, egg: 14, wool: 10, blueberry: 8 }, tier: 3 },
      ];
      for (const r of warriorRecipes) {
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier)
           VALUES ($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::INT, $5::INT, $6::NUMERIC, $7::jsonb, $8::INT)`,
          [r.name, r.target, r.effect_type, r.effect_value, r.dur, r.cook, JSON.stringify(r.ingr), r.tier]
        );
      }
      console.log('3 warrior defense recipes added');
    }

    console.log('Kitchen system migrated');

    // ── Quest System ─────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS quest_definitions (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title         VARCHAR(150) NOT NULL,
        description   VARCHAR(255) NOT NULL,
        quest_type    VARCHAR(20)  NOT NULL CHECK (quest_type IN ('daily', 'weekly')),
        difficulty    VARCHAR(30)  NOT NULL CHECK (difficulty IN (
                        'easy', 'medium', 'action', 'passive',
                        'weekly_easy', 'weekly_medium', 'weekly_hard'
                      )),
        category      VARCHAR(30)  NOT NULL,
        action_key    VARCHAR(50)  NOT NULL,
        target_count  INT          NOT NULL DEFAULT 1,
        reward_coins  INT          NOT NULL,
        metadata      JSONB        NOT NULL DEFAULT '{}',
        scale_factors JSONB        NOT NULL DEFAULT '{"t1":1.0,"t2":1.5,"t3":2.5}',
        is_active     BOOLEAN      NOT NULL DEFAULT TRUE
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS player_quests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id       UUID REFERENCES players(id) ON DELETE CASCADE,
        definition_id   UUID REFERENCES quest_definitions(id),
        quest_type      VARCHAR(20)  NOT NULL,
        period_key      VARCHAR(20)  NOT NULL,
        progress        INT          NOT NULL DEFAULT 0,
        target_count    INT          NOT NULL,
        reward_coins    INT          NOT NULL,
        metadata        JSONB        NOT NULL DEFAULT '{}',
        status          VARCHAR(20)  NOT NULL DEFAULT 'in_progress',
        bonus_claimed   BOOLEAN      NOT NULL DEFAULT FALSE,
        assigned_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMPTZ,
        claimed_at      TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_player_quests_period_def
        ON player_quests (player_id, period_key, definition_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_player_quests_player_period
        ON player_quests (player_id, period_key)
    `);

    console.log('Quest system migrated');

    // ── Fix quest titles/descriptions (remove hardcoded numbers that conflict with scaling) ──
    await query(`
      UPDATE quest_definitions SET
        title = CASE title
          WHEN 'Feed Animals 3 Times'        THEN 'Feed Animals'
          WHEN 'Collect from Farmers 3 Times' THEN 'Collect from Farmers'
          WHEN 'Complete 2 Harvest Dungeons'  THEN 'Complete Harvest Dungeons'
          WHEN 'Collect Animal Products 3x'   THEN 'Collect Animal Products'
          WHEN 'Cook 2 Meals'                 THEN 'Cook Meals'
          ELSE title
        END,
        description = CASE title
          WHEN 'Feed Animals 3 Times'             THEN 'Feed any animal.'
          WHEN 'Feed Animals'                     THEN 'Feed any animal.'
          WHEN 'Collect from Farmers 3 Times'     THEN 'Collect resources from farmers.'
          WHEN 'Collect from Farmers'             THEN 'Collect resources from farmers.'
          WHEN 'Complete 2 Harvest Dungeons'      THEN 'Win harvest dungeon runs.'
          WHEN 'Complete Harvest Dungeons'        THEN 'Win harvest dungeon runs.'
          WHEN 'Collect Animal Products 3x'       THEN 'Collect produce from animals.'
          WHEN 'Collect Animal Products'          THEN 'Collect produce from animals.'
          WHEN 'Cook 2 Meals'                     THEN 'Cook meals in the kitchen.'
          WHEN 'Cook Meals'                       THEN 'Cook meals in the kitchen.'
          WHEN 'Gather Pinecone'                  THEN 'Collect pinecone from farmers.'
          WHEN 'Gather Strawberry'                THEN 'Collect strawberry from farmers.'
          WHEN 'Gather Blueberry'                 THEN 'Collect blueberry from farmers.'
          WHEN 'Collect Eggs'                     THEN 'Collect eggs from chickens.'
          WHEN 'Collect Wool'                     THEN 'Collect wool from sheep.'
          WHEN 'Collect Milk'                     THEN 'Collect milk from cows.'
          WHEN 'PvP Participant'                  THEN 'Start PvP battles.'
          WHEN 'Kitchen Student'                  THEN 'Cook meals.'
          WHEN 'Dungeon Explorer'                 THEN 'Enter adventure dungeons.'
          WHEN 'Diligent Farmer'                  THEN 'Collect resources from farmers.'
          WHEN 'PvP Victor'                       THEN 'Win PvP battles.'
          WHEN 'Harvest Master'                   THEN 'Win harvest dungeon runs.'
          WHEN 'Animal Caretaker'                 THEN 'Collect produce from animals.'
          WHEN 'Pinecone Baron'                   THEN 'Collect pinecone from farmers.'
          WHEN 'Head Chef'                        THEN 'Use prepared meals.'
          WHEN 'PvP Champion'                     THEN 'Win PvP battles.'
          WHEN 'Archer Duelist'                   THEN 'Win PvP battles with an Archer.'
          WHEN 'Warrior Duelist'                  THEN 'Win PvP battles with a Warrior.'
          WHEN 'Deep Dungeon'                     THEN 'Win harvest dungeon runs.'
          WHEN 'Egg Producer'                     THEN 'Collect eggs from chickens.'
          WHEN 'Wool Producer'                    THEN 'Collect wool from sheep.'
          WHEN 'Upgrade Enthusiast'               THEN 'Upgrade any farmer or animal.'
          ELSE description
        END
    `);
    console.log('Quest titles/descriptions cleaned up');

    // ── Gear System ───────────────────────────────────────────────────────────

    await query(`
      CREATE TABLE IF NOT EXISTS gear_definitions (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        gear_type VARCHAR(20) NOT NULL,
        class_restriction VARCHAR(50),
        tier INT DEFAULT 1,
        base_attack INT DEFAULT 0,
        base_defense INT DEFAULT 0,
        base_chance INT DEFAULT 0,
        atk_increment INT DEFAULT 0,
        def_increment INT DEFAULT 0,
        chance_increment INT DEFAULT 0,
        emoji VARCHAR(10) DEFAULT '⚔️'
      )
    `);
    console.log('Created table: gear_definitions');

    await query(`
      CREATE TABLE IF NOT EXISTS player_gear (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        definition_id VARCHAR(50) REFERENCES gear_definitions(id),
        rarity VARCHAR(10) DEFAULT 'common',
        level INT DEFAULT 1,
        equipped_champion_id UUID REFERENCES champions(id) ON DELETE SET NULL,
        equipped_slot VARCHAR(20),
        acquired_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created table: player_gear');

    // Gear loot tables — optional dungeon-specific item pools (weighted)
    await query(`
      CREATE TABLE IF NOT EXISTS gear_loot_tables (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dungeon_id    UUID NOT NULL REFERENCES dungeons(id) ON DELETE CASCADE,
        definition_id VARCHAR(50) NOT NULL REFERENCES gear_definitions(id),
        weight        INT NOT NULL DEFAULT 1,
        UNIQUE (dungeon_id, definition_id)
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_gear_loot_tables_dungeon
        ON gear_loot_tables (dungeon_id)
    `);
    console.log('Created table: gear_loot_tables');

    // gear_upgrade_tier on recipes — which tier of gear a forge stone upgrades
    await query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS gear_upgrade_tier INT`);
    console.log('Ensured recipes.gear_upgrade_tier column');

    // Update forge stone costs to require significantly more resources (balance)
    await query(`UPDATE recipes SET ingredients = '{"pinecone": 30, "blueberry": 25}'::jsonb WHERE name = 'Forge Stone' AND effect_type = 'gear_upgrade'`);
    await query(`UPDATE recipes SET ingredients = '{"pinecone": 40, "blueberry": 35, "egg": 20}'::jsonb WHERE name = 'Fine Forge Stone' AND effect_type = 'gear_upgrade'`);
    await query(`UPDATE recipes SET ingredients = '{"pinecone": 50, "blueberry": 45, "egg": 30, "wool": 25}'::jsonb WHERE name = 'Master Forge Stone' AND effect_type = 'gear_upgrade'`);
    console.log('Updated forge stone ingredient costs');

    // ── Attack boost recipes ──────────────────────────────────────────────────
    const attackRecipes = [
      // T1 — one-shot (next battle)
      { name: 'Wild Berry Tonic',      target: 'fighters', effect_type: 'boost_attack', effect_value: 5,  dur: null, cook: 4,  ingr: { strawberry: 4, blueberry: 3 },            tier: 1 },
      // T1 — timed (30 min)
      { name: 'Spiced Pinecone Brew',  target: 'fighters', effect_type: 'boost_attack', effect_value: 6,  dur: 30,   cook: 6,  ingr: { blueberry: 5, pinecone: 4 },             tier: 1 },
      // T2 — one-shot (next battle)
      { name: 'Battle Berry Stew',     target: 'fighters', effect_type: 'boost_attack', effect_value: 10, dur: null, cook: 10, ingr: { blueberry: 10, egg: 6, strawberry: 5 },   tier: 2 },
      // T2 — timed (45 min)
      { name: 'Ironbark Attack Broth', target: 'fighters', effect_type: 'boost_attack', effect_value: 8,  dur: 45,   cook: 15, ingr: { pinecone: 10, blueberry: 8, egg: 5 },     tier: 2 },
      // T3 — one-shot (next battle)
      { name: "Dragon's Wrath Elixir", target: 'fighters', effect_type: 'boost_attack', effect_value: 18, dur: null, cook: 20, ingr: { blueberry: 15, egg: 10, wool: 6 },        tier: 3 },
      // T3 — timed (60 min)
      { name: 'Ancient Forest Rage',   target: 'fighters', effect_type: 'boost_attack', effect_value: 12, dur: 60,   cook: 25, ingr: { pinecone: 20, blueberry: 12, egg: 8, wool: 4 }, tier: 3 },
    ];
    for (const r of attackRecipes) {
      const existing = await query(`SELECT id FROM recipes WHERE name = $1`, [r.name]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier)
           VALUES ($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::jsonb, $8::INT)`,
          [r.name, r.target, r.effect_type, r.effect_value, r.dur, r.cook, JSON.stringify(r.ingr), r.tier]
        );
      }
    }
    console.log('Attack boost recipes ensured');

    // ── Weekly quest reward_coins rebalance (April 2026) ─────────────────────
    // weekly_easy: 15→8, weekly_medium: 20→12, weekly_hard: 25→15
    await query(`UPDATE quest_definitions SET reward_coins = 8  WHERE quest_type = 'weekly' AND difficulty = 'weekly_easy'  AND reward_coins = 15`);
    await query(`UPDATE quest_definitions SET reward_coins = 12 WHERE quest_type = 'weekly' AND difficulty = 'weekly_medium' AND reward_coins = 20`);
    await query(`UPDATE quest_definitions SET reward_coins = 15 WHERE quest_type = 'weekly' AND difficulty = 'weekly_hard'   AND reward_coins = 25`);
    console.log('Weekly quest rewards rebalanced');

    // ── Adventure Dungeon Level System (3 levels × 10 stages, boss battles) ────
    await query(`ALTER TABLE dungeons ADD COLUMN IF NOT EXISTS dungeon_level INT DEFAULT 1`);
    await query(`ALTER TABLE dungeon_runs ADD COLUMN IF NOT EXISTS champion_id_2 UUID REFERENCES champions(id) ON DELETE SET NULL DEFAULT NULL`);
    console.log('Added dungeon_level + champion_id_2 columns');

    // Compute dungeon_level from stage_number for all adventure dungeons
    await query(`
      UPDATE dungeons
        SET dungeon_level = CEIL(stage_number::float / 10)
        WHERE dungeon_type = 'adventure' AND stage_number IS NOT NULL
    `);

    // Only stages 10, 20, 30 are boss stages now (5 and 15 demoted)
    await query(`UPDATE dungeons SET is_boss_stage = FALSE WHERE dungeon_type = 'adventure' AND stage_number IN (5, 15)`);
    console.log('Fixed adventure dungeon boss stages (only 10, 20, 30 are bosses)');

    // Seed adventure stages 16-30 (levels 2 & 3 expansion)
    const newAdventureStages = [
      // Level 2 completion — stages 16-19
      { stage: 16, name: 'Moonlit Forest',      desc: 'A twilight forest where shadow wolves prowl.',                        enemy: 'Shadow Wolf',     atk: 38, def: 20, chc: 25, hp: 175, dur: 35, coins: 30,  xp: 200, boss: false, lv: 2, amt: 8  },
      { stage: 17, name: 'Storm Peak',           desc: 'A mountain summit lashed by eternal thunder.',                       enemy: 'Thunder Eagle',   atk: 42, def: 22, chc: 28, hp: 185, dur: 35, coins: 35,  xp: 220, boss: false, lv: 2, amt: 8  },
      { stage: 18, name: 'Ice Fortress',         desc: 'A frozen fortress carved from glacial ice.',                         enemy: 'Frost Golem',     atk: 46, def: 26, chc: 22, hp: 200, dur: 40, coins: 40,  xp: 250, boss: false, lv: 2, amt: 8  },
      { stage: 19, name: 'Lava Plains',          desc: 'Scorched flatlands where fire salamanders roam.',                    enemy: 'Fire Salamander', atk: 50, def: 24, chc: 30, hp: 210, dur: 40, coins: 45,  xp: 280, boss: false, lv: 2, amt: 8  },
      // Level 2 boss — stage 20
      { stage: 20, name: "Demon Warlord's Keep", desc: 'The fortified stronghold of a fearsome demon warlord.',             enemy: 'Demon Warlord',   atk: 65, def: 35, chc: 32, hp: 320, dur: 45, coins: 100, xp: 400, boss: true,  lv: 2, amt: 20 },
      // Level 3 stages — stages 21-29
      { stage: 21, name: 'Umbral Wastes',        desc: 'A desolate realm where shade specters drift endlessly.',             enemy: 'Shade Specter',   atk: 55, def: 28, chc: 33, hp: 225, dur: 40, coins: 50,  xp: 300, boss: false, lv: 3, amt: 12 },
      { stage: 22, name: 'Dragonspine Peak',     desc: 'A jagged mountain range where wyverns make their nests.',           enemy: 'Wyvern',          atk: 60, def: 30, chc: 30, hp: 240, dur: 45, coins: 55,  xp: 330, boss: false, lv: 3, amt: 12 },
      { stage: 23, name: 'Ancient Ruins',        desc: 'Collapsed temples guarded by a dormant stone colossus.',            enemy: 'Stone Colossus',  atk: 64, def: 34, chc: 28, hp: 255, dur: 45, coins: 60,  xp: 360, boss: false, lv: 3, amt: 12 },
      { stage: 24, name: 'The Abyss',            desc: 'A bottomless chasm filled with void crawlers.',                     enemy: 'Void Crawler',    atk: 68, def: 32, chc: 35, hp: 265, dur: 50, coins: 65,  xp: 390, boss: false, lv: 3, amt: 12 },
      { stage: 25, name: 'Celestial Tower',      desc: 'A tower reaching the heavens, guarded by a fallen paladin.',        enemy: 'Fallen Paladin',  atk: 70, def: 36, chc: 32, hp: 280, dur: 50, coins: 70,  xp: 420, boss: false, lv: 3, amt: 12 },
      { stage: 26, name: 'Dark Forest',          desc: 'An ancient forest where cursed knights stand eternal vigil.',       enemy: 'Cursed Knight',   atk: 74, def: 38, chc: 34, hp: 290, dur: 50, coins: 75,  xp: 450, boss: false, lv: 3, amt: 12 },
      { stage: 27, name: "Titan's Lair",         desc: "Deep within the earth, a stone titan guards its domain.",           enemy: 'Stone Titan',     atk: 78, def: 42, chc: 30, hp: 310, dur: 55, coins: 80,  xp: 480, boss: false, lv: 3, amt: 12 },
      { stage: 28, name: 'Eternal Flame',        desc: 'A realm of fire where an inferno djinn holds court.',               enemy: 'Inferno Djinn',   atk: 82, def: 38, chc: 38, hp: 325, dur: 55, coins: 85,  xp: 510, boss: false, lv: 3, amt: 12 },
      { stage: 29, name: 'Void Sanctum',         desc: 'The inner sanctum of the void, home to an ancient void archon.',   enemy: 'Void Archon',     atk: 86, def: 44, chc: 36, hp: 340, dur: 60, coins: 90,  xp: 540, boss: false, lv: 3, amt: 12 },
      // Level 3 boss — stage 30
      { stage: 30, name: 'The Elder Dragon',     desc: 'The ancient dragon that presides over all darkness. Two champions required.', enemy: 'Ancient Dragon', atk: 100, def: 55, chc: 42, hp: 500, dur: 60, coins: 250, xp: 800, boss: true, lv: 3, amt: 35 },
    ];
    for (const s of newAdventureStages) {
      await query(`
        INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
          duration_minutes, reward_resource, reward_amount, dungeon_type, stage_number, is_boss_stage, coin_reward, xp_reward, dungeon_level)
        SELECT $1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT,
               $8::INT, 'pinecone', $9::INT, 'adventure', $10::INT, $11::BOOLEAN, $12::INT, $13::INT, $14::INT
        WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = $1::VARCHAR)
      `, [s.name, s.desc, s.enemy, s.atk, s.def, s.chc, s.hp, s.dur, s.amt, s.stage, s.boss, s.coins, s.xp, s.lv]);
    }
    console.log('Seeded adventure stages 16-30 (3-level system with boss battles)');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
