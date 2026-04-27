require('dotenv').config();
const { query } = require('./db');
const { HARVEST_DUNGEONS, ADVENTURE_STAGES, RECIPES, FORGE_STONES, STAR_MILESTONES } = require('./data');
const { resolveContent, getLocalizedField } = require('./data/helpers/i18n');

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
    for (const m of STAR_MILESTONES) {
      const mLabel = getLocalizedField(m.label, 'en');
      await query(`
        INSERT INTO adventure_star_milestones (required_stars, reward_coins, label)
        VALUES ($1::INT, $2::INT, $3::VARCHAR)
        ON CONFLICT (required_stars) DO NOTHING
      `, [m.required_stars, m.reward_coins, mLabel]);
    }

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

    // Seed harvest dungeons — imported from data/content/harvestDungeons.js.
    // ON CONFLICT DO UPDATE ensures the DB always matches these definitions.
    // duration_seconds is explicitly kept NULL for harvest dungeons.
    for (const d of HARVEST_DUNGEONS) {
      const name      = getLocalizedField(d.name,  'en');
      const desc      = getLocalizedField(d.desc,  'en');
      const enemyName = getLocalizedField(d.enemy, 'en');
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
      `, [name, desc, enemyName, d.atk, d.def, d.chc, d.hp, d.dur, d.res, d.amt, d.res2 ?? null, d.amt2, d.cooldown, d.limit ?? null, d.minLv ?? null, JSON.stringify(d.extra ?? [])]);
    }

    // Seed adventure stages 6-15 (idempotent) — imported from data/content/adventureStages.js
    const adventureStages6to15 = ADVENTURE_STAGES.filter(s => s.stage >= 6 && s.stage <= 15);
    for (const s of adventureStages6to15) {
      const sName  = getLocalizedField(s.name,  'en');
      const sDesc  = getLocalizedField(s.desc,  'en');
      const sEnemy = getLocalizedField(s.enemy, 'en');
      await query(`
        INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
          duration_minutes, reward_resource, reward_amount, dungeon_type, stage_number, is_boss_stage, coin_reward, xp_reward)
        SELECT $1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT,
               $8::INT, 'pinecone', 5, 'adventure', $9::INT, $10::BOOLEAN, $11::INT, $12::INT
        WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = $1::VARCHAR)
      `, [sName, sDesc, sEnemy, s.atk, s.def, s.chc, s.hp, s.dur, s.stage, s.boss, s.coins, s.xp]);
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
    const WARRIOR_RECIPE_NAMES = new Set(['Forest Warrior Brew', 'Shield Bark Soup', 'Titanwood Feast']);
    if (!ironbarkCheck.length) {
      // Clear stale cooking/boost state so nothing references the old recipe UUIDs
      await query(`DELETE FROM active_boosts`);
      await query(`DELETE FROM player_food`);
      await query(`DELETE FROM recipes`);

      const baseRecipes = RECIPES.filter(r => r.effect_type !== 'boost_attack' && !WARRIOR_RECIPE_NAMES.has(getLocalizedField(r.name, 'en')));
      for (const r of baseRecipes) {
        const rName = getLocalizedField(r.name, 'en');
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier)
           VALUES ($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::jsonb, $8::INT)`,
          [rName, r.target, r.effect_type, r.effect_value, r.dur, r.cook, JSON.stringify(r.ingr), r.tier]
        );
      }
      console.log('Recipes v2 seeded (11 new recipes)');
    }

    // Allow fractional cook times (e.g. 0.5 for 30 seconds — used for test recipes)
    await query(`ALTER TABLE recipes ALTER COLUMN cook_duration_minutes TYPE NUMERIC`);

    // Add 3 new warriors-only timed defense recipes if they don't exist yet
    const warriorBrewCheck = await query(`SELECT 1 FROM recipes WHERE name = 'Forest Warrior Brew' LIMIT 1`);
    if (!warriorBrewCheck.length) {
      const warriorRecipesList = RECIPES.filter(r => WARRIOR_RECIPE_NAMES.has(getLocalizedField(r.name, 'en')));
      for (const r of warriorRecipesList) {
        const rName = getLocalizedField(r.name, 'en');
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier)
           VALUES ($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::INT, $5::INT, $6::NUMERIC, $7::jsonb, $8::INT)`,
          [rName, r.target, r.effect_type, r.effect_value, r.dur, r.cook, JSON.stringify(r.ingr), r.tier]
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
    const attackBoostRecipes = RECIPES.filter(r => r.effect_type === 'boost_attack');
    for (const r of attackBoostRecipes) {
      const rName = getLocalizedField(r.name, 'en');
      const existing = await query(`SELECT id FROM recipes WHERE name = $1`, [rName]);
      if (existing.length === 0) {
        await query(
          `INSERT INTO recipes (name, target, effect_type, effect_value, effect_duration_minutes, cook_duration_minutes, ingredients, tier)
           VALUES ($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::jsonb, $8::INT)`,
          [rName, r.target, r.effect_type, r.effect_value, r.dur, r.cook, JSON.stringify(r.ingr), r.tier]
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

    // Seed adventure stages 16-30 — imported from data/content/adventureStages.js
    const stages16to30 = ADVENTURE_STAGES.filter(s => s.stage >= 16);
    for (const s of stages16to30) {
      const sName  = getLocalizedField(s.name,  'en');
      const sDesc  = getLocalizedField(s.desc,  'en');
      const sEnemy = getLocalizedField(s.enemy, 'en');
      await query(`
        INSERT INTO dungeons (name, description, enemy_name, enemy_attack, enemy_defense, enemy_chance, enemy_hp,
          duration_minutes, reward_resource, reward_amount, dungeon_type, stage_number, is_boss_stage, coin_reward, xp_reward, dungeon_level)
        SELECT $1::VARCHAR, $2::TEXT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT,
               $8::INT, 'pinecone', $9::INT, 'adventure', $10::INT, $11::BOOLEAN, $12::INT, $13::INT, $14::INT
        WHERE NOT EXISTS (SELECT 1 FROM dungeons WHERE name = $1::VARCHAR)
      `, [sName, sDesc, sEnemy, s.atk, s.def, s.chc, s.hp, s.dur, s.amt, s.stage, s.boss, s.coins, s.xp, s.lv]);
    }
    console.log('Seeded adventure stages 16-30 (3-level system with boss battles)');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit(0);
}

migrate();
