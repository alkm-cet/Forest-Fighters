const express = require('express');
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Rarity multipliers ────────────────────────────────────────────────────────
const RARITY_MULT = { common: 1.0, rare: 1.35, epic: 1.75 };

/**
 * Compute stat bonus for a single gear piece at a given rarity + level.
 * Formula: floor(base * mult) + (level - 1) * floor(increment * mult)
 */
function computeGearStats(def, rarity, level) {
  const m = RARITY_MULT[rarity] ?? 1.0;
  return {
    attack_bonus:  Math.floor(def.base_attack  * m) + (level - 1) * Math.floor(def.atk_increment    * m),
    defense_bonus: Math.floor(def.base_defense * m) + (level - 1) * Math.floor(def.def_increment    * m),
    chance_bonus:  Math.floor(def.base_chance  * m) + (level - 1) * Math.floor(def.chance_increment * m),
  };
}

/**
 * Returns the full equipped gear snapshot for a champion: { weapon, charm }.
 * Each slot is a full PlayerGear-like object (with definition + computed bonuses),
 * or null if nothing is equipped in that slot.
 * Used to snapshot gear at battle creation time for display in battle history.
 */
async function getChampionEquippedGearSnapshot(championId) {
  const rows = await query(
    `SELECT pg.*, row_to_json(gd.*) AS definition
     FROM player_gear pg
     JOIN gear_definitions gd ON pg.definition_id = gd.id
     WHERE pg.equipped_champion_id = $1`,
    [championId]
  );
  const result = { weapon: null, charm: null };
  for (const row of rows) {
    const def = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition;
    const stats = computeGearStats(def, row.rarity, row.level);
    const gear = { ...row, definition: def, ...stats };
    if (gear.equipped_slot === 'weapon') result.weapon = gear;
    else if (gear.equipped_slot === 'charm') result.charm = gear;
  }
  return result;
}

/**
 * Returns { attack, defense, chance } gear bonuses for an equipped champion.
 * Each value is BEFORE the 50% cap — callers apply the cap themselves.
 */
async function getChampionGearBonuses(championId) {
  const rows = await query(
    `SELECT pg.rarity, pg.level,
            gd.base_attack, gd.base_defense, gd.base_chance,
            gd.atk_increment, gd.def_increment, gd.chance_increment
     FROM player_gear pg
     JOIN gear_definitions gd ON pg.definition_id = gd.id
     WHERE pg.equipped_champion_id = $1`,
    [championId]
  );
  let attack = 0, defense = 0, chance = 0;
  for (const row of rows) {
    const s = computeGearStats(row, row.rarity, row.level);
    attack  += s.attack_bonus;
    defense += s.defense_bonus;
    chance  += s.chance_bonus;
  }
  return { attack, defense, chance };
}

/**
 * Insert one gear piece and return it with definition + computed stats.
 */
async function insertGearDrop(playerId, definitionId, rarity) {
  const inserted = await query(
    `INSERT INTO player_gear (player_id, definition_id, rarity, level)
     VALUES ($1, $2, $3, 1) RETURNING *`,
    [playerId, definitionId, rarity]
  );
  const gear = inserted[0];
  const defRows = await query('SELECT * FROM gear_definitions WHERE id = $1', [definitionId]);
  const def = defRows[0];
  const stats = computeGearStats(def, rarity, 1);
  return { ...gear, definition: def, ...stats };
}

/**
 * Roll gear drops after a dungeon victory.
 * Returns an array of PlayerGear rows (empty = no drop).
 * Special stage 99 = "Test Chamber": always drops both weapon and charm (T1 epic).
 */
/**
 * Returns a definition_id from gear_loot_tables for a specific dungeon,
 * applying weighted random selection. Returns null if no entries exist
 * for this dungeon+gearType+tier+class combination (triggers tier-based fallback).
 */
async function rollFromLootTable(dungeonId, gearType, champClass, tier) {
  const rows = await query(
    `SELECT glt.definition_id, glt.weight
     FROM gear_loot_tables glt
     JOIN gear_definitions gd ON gd.id = glt.definition_id
     WHERE glt.dungeon_id = $1
       AND gd.gear_type = $2
       AND gd.tier = $3
       AND (gd.class_restriction IS NULL OR gd.class_restriction = $4)`,
    [dungeonId, gearType, tier, champClass]
  );
  if (rows.length === 0) return null;
  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const row of rows) {
    roll -= row.weight;
    if (roll < 0) return row.definition_id;
  }
  return rows[rows.length - 1].definition_id;
}

async function rollGearDrop(run, playerId) {
  const { dungeon_type, is_boss_stage, stage_number, dungeon_level, champion_id, dungeon_id } = run;
  const level = dungeon_level ?? (stage_number <= 10 ? 1 : stage_number <= 20 ? 2 : 3);

  if (dungeon_type === 'harvest') return [];

  // ── Drop chance ───────────────────────────────────────────────────────────
  // Stage 1: 100% (tutorial discovery). Higher levels = lower frequency, better tier.
  let dropChance;
  if (stage_number === 1)           dropChance = 1.0;
  else if (dungeon_type === 'event') dropChance = 0.35;
  else if (is_boss_stage)            dropChance = 0.28;
  else if (level === 1)              dropChance = 0.10;
  else if (level === 2)              dropChance = 0.08;
  else                               dropChance = 0.06;

  if (Math.random() >= dropChance) return [];

  // ── Tier — based on dungeon level, not raw stage number ──────────────────
  let tier;
  if (dungeon_type === 'event') {
    tier = Math.random() < 0.5 ? 2 : 3;
  } else if (is_boss_stage) {
    // Boss drops guaranteed tier ≥ current level, weighted upward
    tier = level === 1 ? (Math.random() < 0.5 ? 1 : 2) : level === 2 ? (Math.random() < 0.5 ? 2 : 3) : 3;
  } else {
    tier = level; // Normal dungeons drop tier matching their level
  }

  // ── Rarity — higher level = better rarity distribution ───────────────────
  let rarity;
  const rarityRoll = Math.random();
  if (dungeon_type === 'event') {
    rarity = rarityRoll < 0.6 ? 'rare' : 'epic';
  } else if (is_boss_stage) {
    // Boss: 30% common, 50% rare, 20% epic
    rarity = rarityRoll < 0.30 ? 'common' : rarityRoll < 0.80 ? 'rare' : 'epic';
  } else if (level === 1) {
    // Level 1: mostly common
    rarity = rarityRoll < 0.75 ? 'common' : rarityRoll < 0.95 ? 'rare' : 'epic';
  } else if (level === 2) {
    // Level 2: more rare
    rarity = rarityRoll < 0.55 ? 'common' : rarityRoll < 0.90 ? 'rare' : 'epic';
  } else {
    // Level 3: more epic
    rarity = rarityRoll < 0.35 ? 'common' : rarityRoll < 0.80 ? 'rare' : 'epic';
  }

  // Stage 1 always drops BOTH a weapon and a charm (discovery run)
  if (stage_number === 1) {
    const champRows = await query('SELECT class FROM champions WHERE id = $1', [champion_id]);
    if (champRows.length === 0) return [];
    const champClass = champRows[0].class;
    const [weaponRows, charmRows] = await Promise.all([
      query(`SELECT id FROM gear_definitions WHERE gear_type = 'weapon' AND class_restriction = $1 AND tier = 1`, [champClass]),
      query(`SELECT id FROM gear_definitions WHERE gear_type = 'charm' AND class_restriction IS NULL AND tier = 1`),
    ]);
    const drops = [];
    if (weaponRows.length > 0) {
      const wId = weaponRows[Math.floor(Math.random() * weaponRows.length)].id;
      drops.push(await insertGearDrop(playerId, wId, 'common'));
    }
    if (charmRows.length > 0) {
      const cId = charmRows[Math.floor(Math.random() * charmRows.length)].id;
      drops.push(await insertGearDrop(playerId, cId, 'common'));
    }
    return drops;
  }

  // Determine gear type (60% weapon for champion's class, 40% charm)
  const champRows = await query('SELECT class FROM champions WHERE id = $1', [champion_id]);
  if (champRows.length === 0) return [];
  const champClass = champRows[0].class;

  let definitionId;
  if (Math.random() < 0.6) {
    // 1. Dungeon-specific loot table (weighted) → 2. Tier-based fallback
    definitionId = await rollFromLootTable(dungeon_id, 'weapon', champClass, tier);
    if (!definitionId) {
      const weaponRows = await query(
        `SELECT id FROM gear_definitions WHERE gear_type = 'weapon' AND class_restriction = $1 AND tier = $2`,
        [champClass, tier]
      );
      if (weaponRows.length === 0) return [];
      definitionId = weaponRows[Math.floor(Math.random() * weaponRows.length)].id;
    }
  } else {
    // 1. Dungeon-specific loot table (weighted) → 2. Tier-based fallback
    definitionId = await rollFromLootTable(dungeon_id, 'charm', champClass, tier);
    if (!definitionId) {
      const charmRows = await query(
        `SELECT id FROM gear_definitions WHERE gear_type = 'charm' AND class_restriction IS NULL AND tier = $1`,
        [tier]
      );
      if (charmRows.length === 0) return [];
      definitionId = charmRows[Math.floor(Math.random() * charmRows.length)].id;
    }
  }

  return [await insertGearDrop(playerId, definitionId, rarity)];
}

// ── GET /api/gear/definitions ────────────────────────────────────────────────
router.get('/definitions', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM gear_definitions ORDER BY class_restriction NULLS LAST, tier, name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gear definitions' });
  }
});

// ── GET /api/gear/definitions/:definitionId/dungeons ──────────────────────────
router.get('/definitions/:definitionId/dungeons', authMiddleware, async (req, res) => {
  const { definitionId } = req.params;
  try {
    const defRows = await query('SELECT tier FROM gear_definitions WHERE id = $1', [definitionId]);
    if (!defRows.length) return res.status(404).json({ error: 'Gear definition not found' });
    const tier = defRows[0].tier;

    const dungeons = await query(`
      WITH eff AS (
        SELECT *,
          COALESCE(dungeon_level,
            CASE WHEN stage_number <= 10 THEN 1
                 WHEN stage_number <= 20 THEN 2
                 ELSE 3 END) AS effective_level
        FROM dungeons
        WHERE dungeon_type = 'adventure'
      )
      SELECT eff.*
      FROM eff
      WHERE
        EXISTS (SELECT 1 FROM gear_loot_tables glt
                WHERE glt.dungeon_id = eff.id AND glt.definition_id = $1)
        OR (NOT eff.is_boss_stage AND eff.effective_level = $2)
        OR (eff.is_boss_stage
            AND eff.effective_level >= $2 - 1
            AND eff.effective_level <= $2)
      ORDER BY eff.stage_number
    `, [definitionId, tier]);

    res.json(dungeons);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dungeons for gear' });
  }
});

// ── GET /api/gear/inventory ───────────────────────────────────────────────────
router.get('/inventory', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    const rows = await query(
      `SELECT pg.*, row_to_json(gd.*) AS definition
       FROM player_gear pg
       JOIN gear_definitions gd ON pg.definition_id = gd.id
       WHERE pg.player_id = $1
       ORDER BY (pg.equipped_champion_id IS NOT NULL) DESC, pg.acquired_at DESC`,
      [playerId]
    );

    const result = rows.map(row => {
      const def = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition;
      const stats = computeGearStats(def, row.rarity, row.level);
      return { ...row, definition: def, ...stats };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /gear/inventory error:', err);
    res.status(500).json({ error: 'Failed to fetch gear inventory' });
  }
});

// ── POST /api/gear/:gearId/equip ─────────────────────────────────────────────
router.post('/:gearId/equip', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { gearId } = req.params;
  const { champion_id, slot } = req.body;

  if (!champion_id || !slot) {
    return res.status(400).json({ error: 'champion_id and slot are required' });
  }

  try {
    // Validate gear belongs to player
    const gearRows = await query(
      `SELECT pg.*, gd.gear_type, gd.class_restriction, gd.tier
       FROM player_gear pg
       JOIN gear_definitions gd ON pg.definition_id = gd.id
       WHERE pg.id = $1 AND pg.player_id = $2`,
      [gearId, playerId]
    );
    if (gearRows.length === 0) return res.status(404).json({ error: 'Gear not found' });
    const gear = gearRows[0];

    // Slot must match gear type
    if (slot !== gear.gear_type) {
      return res.status(400).json({ error: `Slot '${slot}' does not match gear type '${gear.gear_type}'` });
    }

    // Validate champion belongs to player
    const champRows = await query(
      'SELECT id, class, is_deployed FROM champions WHERE id = $1 AND player_id = $2',
      [champion_id, playerId]
    );
    if (champRows.length === 0) return res.status(404).json({ error: 'Champion not found' });
    const champ = champRows[0];

    // Block if champion is deployed
    if (champ.is_deployed) {
      return res.status(400).json({ error: 'Cannot change gear while champion is deployed' });
    }

    // Class restriction check
    if (gear.class_restriction && gear.class_restriction !== champ.class) {
      return res.status(400).json({ error: `This gear requires class: ${gear.class_restriction}` });
    }

    // Unequip any existing gear in this slot for this champion
    await query(
      `UPDATE player_gear SET equipped_champion_id = NULL, equipped_slot = NULL
       WHERE equipped_champion_id = $1 AND equipped_slot = $2`,
      [champion_id, slot]
    );

    // Unequip this gear from wherever it currently is
    await query(
      `UPDATE player_gear SET equipped_champion_id = NULL, equipped_slot = NULL WHERE id = $1`,
      [gearId]
    );

    // Equip
    await query(
      `UPDATE player_gear SET equipped_champion_id = $1, equipped_slot = $2 WHERE id = $3`,
      [champion_id, slot, gearId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /gear/equip error:', err);
    res.status(500).json({ error: 'Failed to equip gear' });
  }
});

// ── POST /api/gear/:gearId/unequip ───────────────────────────────────────────
router.post('/:gearId/unequip', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { gearId } = req.params;

  try {
    const gearRows = await query(
      'SELECT pg.*, c.is_deployed FROM player_gear pg LEFT JOIN champions c ON pg.equipped_champion_id = c.id WHERE pg.id = $1 AND pg.player_id = $2',
      [gearId, playerId]
    );
    if (gearRows.length === 0) return res.status(404).json({ error: 'Gear not found' });
    const gear = gearRows[0];

    if (gear.is_deployed) {
      return res.status(400).json({ error: 'Cannot unequip gear while champion is deployed' });
    }

    await query(
      'UPDATE player_gear SET equipped_champion_id = NULL, equipped_slot = NULL WHERE id = $1',
      [gearId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /gear/unequip error:', err);
    res.status(500).json({ error: 'Failed to unequip gear' });
  }
});

// ── DELETE /api/gear/:gearId ─────────────────────────────────────────────────
// Discard unequipped gear in exchange for coins.
// Coin formula: rarityBonus + (tier - 1) + level
//   common=0, rare=2, epic=4 (rarity bonus) + tier offset + level
router.delete('/:gearId', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { gearId } = req.params;

  try {
    const gearRows = await query(
      `SELECT pg.*, gd.tier
       FROM player_gear pg
       JOIN gear_definitions gd ON pg.definition_id = gd.id
       WHERE pg.id = $1 AND pg.player_id = $2`,
      [gearId, playerId]
    );
    if (gearRows.length === 0) return res.status(404).json({ error: 'Gear not found' });
    const gear = gearRows[0];

    if (gear.equipped_champion_id) {
      return res.status(400).json({ error: 'Cannot discard equipped gear. Unequip first.' });
    }

    const rarityBonus = gear.rarity === 'epic' ? 4 : gear.rarity === 'rare' ? 2 : 0;
    const coinsAwarded = rarityBonus + (gear.tier - 1) + gear.level;

    await query('DELETE FROM player_gear WHERE id = $1', [gearId]);
    await query('UPDATE players SET coins = COALESCE(coins, 0) + $1 WHERE id = $2', [coinsAwarded, playerId]);

    const playerRows = await query('SELECT coins FROM players WHERE id = $1', [playerId]);
    res.json({ success: true, coinsAwarded, coins: playerRows[0]?.coins ?? 0 });
  } catch (err) {
    console.error('DELETE /gear error:', err);
    res.status(500).json({ error: 'Failed to discard gear' });
  }
});

// ── POST /api/gear/:gearId/upgrade ───────────────────────────────────────────
// Body: { food_ids: [uuid] } for Lv1→Lv2 (1 stone) or { food_ids: [uuid, uuid] } for Lv2→Lv3 (2 stones)
router.post('/:gearId/upgrade', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { gearId } = req.params;
  let { food_ids } = req.body;

  // Accept single food_id for convenience
  if (!food_ids && req.body.food_id) food_ids = [req.body.food_id];
  if (!Array.isArray(food_ids) || food_ids.length === 0) {
    return res.status(400).json({ error: 'food_ids is required' });
  }

  try {
    // Validate gear
    const gearRows = await query(
      `SELECT pg.*, gd.tier FROM player_gear pg
       JOIN gear_definitions gd ON pg.definition_id = gd.id
       WHERE pg.id = $1 AND pg.player_id = $2`,
      [gearId, playerId]
    );
    if (gearRows.length === 0) return res.status(404).json({ error: 'Gear not found' });
    const gear = gearRows[0];

    if (gear.level >= 3) {
      return res.status(400).json({ error: 'Gear is already at maximum level' });
    }

    // Stones needed: 1 for Lv1→Lv2, 2 for Lv2→Lv3
    const stonesNeeded = gear.level === 1 ? 1 : 2;
    if (food_ids.length < stonesNeeded) {
      return res.status(400).json({ error: `Upgrading from Lv${gear.level} requires ${stonesNeeded} forge stone(s)` });
    }

    const stonesToUse = food_ids.slice(0, stonesNeeded);

    // Validate each stone
    for (const foodId of stonesToUse) {
      const foodRows = await query(
        `SELECT pf.id, pf.status, r.effect_type, r.gear_upgrade_tier
         FROM player_food pf
         JOIN recipes r ON pf.recipe_id = r.id
         WHERE pf.id = $1 AND pf.player_id = $2`,
        [foodId, playerId]
      );
      if (foodRows.length === 0) return res.status(404).json({ error: `Forge stone not found: ${foodId}` });
      const food = foodRows[0];

      if (food.status !== 'ready') {
        return res.status(400).json({ error: 'Forge stone is not ready yet' });
      }
      if (food.effect_type !== 'gear_upgrade') {
        return res.status(400).json({ error: 'Item is not a forge stone' });
      }
      // Tier check: stone tier must match gear tier, OR stone is T3 (universal)
      if (food.gear_upgrade_tier !== gear.tier && food.gear_upgrade_tier !== 3) {
        return res.status(400).json({ error: `Forge Stone tier ${food.gear_upgrade_tier} cannot upgrade Tier ${gear.tier} gear` });
      }
    }

    // Mark stones as used
    for (const foodId of stonesToUse) {
      await query(`UPDATE player_food SET status = 'used', used_at = NOW() WHERE id = $1`, [foodId]);
    }

    // Level up gear
    await query('UPDATE player_gear SET level = level + 1 WHERE id = $1', [gearId]);

    // Return updated gear with bonuses
    const updatedRows = await query(
      `SELECT pg.*, row_to_json(gd.*) AS definition
       FROM player_gear pg JOIN gear_definitions gd ON pg.definition_id = gd.id
       WHERE pg.id = $1`,
      [gearId]
    );
    const updated = updatedRows[0];
    const def = typeof updated.definition === 'string' ? JSON.parse(updated.definition) : updated.definition;
    const stats = computeGearStats(def, updated.rarity, updated.level);

    res.json({ ...updated, definition: def, ...stats });
  } catch (err) {
    console.error('POST /gear/upgrade error:', err);
    res.status(500).json({ error: 'Failed to upgrade gear' });
  }
});

module.exports = { router, getChampionGearBonuses, getChampionEquippedGearSnapshot, rollGearDrop };
