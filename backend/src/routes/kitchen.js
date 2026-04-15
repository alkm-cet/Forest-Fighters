const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { incrementQuestProgress } = require('../quests');

// ─── GET /api/kitchen/recipes ────────────────────────────────────────────────
// Return all 11 recipes. Used by Kitchen screen.
router.get('/recipes', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM recipes ORDER BY tier ASC, name ASC`);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// ─── POST /api/kitchen/cook/:recipeId ────────────────────────────────────────
// Start cooking. Deducts ingredients from player_resources, creates player_food
// with status='cooking' and cooking_ready_at = NOW() + cook_duration_minutes.
router.post('/cook/:recipeId', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { recipeId } = req.params;

  try {
    const recipes = await query(`SELECT * FROM recipes WHERE id = $1`, [recipeId]);
    if (!recipes.length) return res.status(404).json({ error: 'Recipe not found' });

    const recipe = recipes[0];
    const ingredients = recipe.ingredients; // JSONB parsed by pg driver

    // Check player has enough of each ingredient
    const [playerRes] = await query(`SELECT * FROM player_resources WHERE player_id = $1`, [playerId]);
    if (!playerRes) return res.status(404).json({ error: 'Resources not found' });

    for (const [resource, amount] of Object.entries(ingredients)) {
      const have = playerRes[resource] ?? 0;
      if (have < amount) {
        return res.status(400).json({
          error: `Not enough ${resource} (have ${have}, need ${amount})`,
          resource,
          have,
          need: amount,
        });
      }
    }

    // Deduct ingredients
    const setClause = Object.entries(ingredients)
      .map(([res, amt], i) => `${res} = GREATEST(${res} - $${i + 2}, 0)`)
      .join(', ');
    const amounts = Object.values(ingredients);
    await query(
      `UPDATE player_resources SET ${setClause} WHERE player_id = $1`,
      [playerId, ...amounts]
    );

    // Create player_food row
    const [food] = await query(
      `INSERT INTO player_food (player_id, recipe_id, status, cooking_started_at, cooking_ready_at)
       VALUES ($1, $2, 'cooking', NOW(), NOW() + ($3 || ' minutes')::interval)
       RETURNING *,
         EXTRACT(EPOCH FROM cooking_ready_at)::BIGINT * 1000   AS cooking_ready_at_ms,
         EXTRACT(EPOCH FROM cooking_started_at)::BIGINT * 1000 AS cooking_started_at_ms`,
      [playerId, recipeId, recipe.cook_duration_minutes]
    );

    // Quest progress
    await incrementQuestProgress(playerId, 'kitchen_cook');

    // Re-fetch resources to return updated totals
    const [updatedRes] = await query(`SELECT * FROM player_resources WHERE player_id = $1`, [playerId]);

    return res.json({
      food: {
        ...food,
        recipe,
        cooking_ready_at_ms:   Number(food.cooking_ready_at_ms),
        cooking_started_at_ms: Number(food.cooking_started_at_ms),
        _fetched_at_ms:        Date.now(),
      },
      resources: updatedRes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Cook failed' });
  }
});

// ─── GET /api/kitchen/inventory ──────────────────────────────────────────────
// Returns player's food items that are 'cooking' or 'ready'.
// Auto-promotes 'cooking' → 'ready' for any items whose cooking_ready_at has passed.
router.get('/inventory', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  try {
    // Promote any cooking items that are done
    await query(
      `UPDATE player_food
         SET status = 'ready'
       WHERE player_id = $1
         AND status = 'cooking'
         AND cooking_ready_at <= NOW()`,
      [playerId]
    );

    const rows = await query(
      `SELECT pf.*,
              row_to_json(r.*) AS recipe,
              EXTRACT(EPOCH FROM pf.cooking_ready_at)::BIGINT   * 1000 AS cooking_ready_at_ms,
              EXTRACT(EPOCH FROM pf.cooking_started_at)::BIGINT * 1000 AS cooking_started_at_ms
         FROM player_food pf
         JOIN recipes r ON r.id = pf.recipe_id
        WHERE pf.player_id = $1
          AND pf.status IN ('cooking', 'ready')
        ORDER BY pf.cooking_started_at ASC`,
      [playerId]
    );

    const fetchedAtMs = Date.now();
    return res.json(rows.map(row => ({
      ...row,
      cooking_ready_at_ms:   Number(row.cooking_ready_at_ms),
      cooking_started_at_ms: Number(row.cooking_started_at_ms),
      _fetched_at_ms: fetchedAtMs,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// ─── POST /api/kitchen/use/:foodId ───────────────────────────────────────────
// Consume a ready food item. Creates an active_boost and marks food as 'used'.
// Body: { entity_id?: string }  — links the boost to a specific champion or farmer.
router.post('/use/:foodId', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { foodId } = req.params;
  const { entity_id } = req.body ?? {};

  try {
    const foods = await query(
      `SELECT pf.*, row_to_json(r.*) AS recipe
         FROM player_food pf
         JOIN recipes r ON r.id = pf.recipe_id
        WHERE pf.id = $1 AND pf.player_id = $2`,
      [foodId, playerId]
    );
    if (!foods.length) return res.status(404).json({ error: 'Food not found' });

    const food   = foods[0];
    const recipe = food.recipe;

    // Promote if ready_at passed but status still 'cooking'
    if (food.status === 'cooking') {
      if (new Date(food.cooking_ready_at) > new Date()) {
        return res.status(400).json({ error: 'Food is still cooking' });
      }
      await query(`UPDATE player_food SET status='ready' WHERE id=$1`, [foodId]);
      food.status = 'ready';
    }

    if (food.status !== 'ready') {
      return res.status(400).json({ error: 'Food is not ready' });
    }

    // Block food application while champion is on a dungeon mission or PvP battle
    if (entity_id && recipe.target === 'fighters') {
      const [activeRun] = await query(
        `SELECT id FROM dungeon_runs
          WHERE champion_id = $1 AND status = 'active' AND ends_at > NOW()`,
        [entity_id]
      );
      if (activeRun) {
        return res.status(400).json({ error: 'Cannot add food while champion is on a mission' });
      }
      const [pendingBattle] = await query(
        `SELECT id FROM pvp_battles
          WHERE attacker_champion_id = $1 AND status = 'pending'`,
        [entity_id]
      );
      if (pendingBattle) {
        return res.status(400).json({ error: 'Cannot add food while champion is in a PvP battle' });
      }
    }

    // is_one_shot = true when recipe has no duration (consumed after next battle)
    const isOneShot = !recipe.effect_duration_minutes;

    // Compute expires_at (NULL duration → set 100 years in future; cleared by battle logic)
    const durationMin = recipe.effect_duration_minutes;
    const expiresAt = durationMin
      ? `NOW() + INTERVAL '${durationMin} minutes'`
      : `NOW() + INTERVAL '100 years'`;

    const [boost] = await query(
      `INSERT INTO active_boosts (player_id, boost_type, boost_value, target, expires_at, entity_id, is_one_shot, recipe_id)
       VALUES ($1, $2, $3, $4, ${expiresAt}, $5, $6, $7)
       RETURNING *, EXTRACT(EPOCH FROM expires_at)::BIGINT * 1000 AS expires_at_ms`,
      [playerId, recipe.effect_type, recipe.effect_value, recipe.target, entity_id ?? null, isOneShot, food.recipe_id]
    );

    // For fighter foods: also write boost value into champion.boost_* column so UI
    // reflects the boost immediately (champion data is displayed in the drawer).
    let updatedChampion = null;
    if (entity_id && recipe.target === 'fighters') {
      const boostCol =
        recipe.effect_type === 'boost_hp'      ? 'boost_hp' :
        recipe.effect_type === 'boost_defense' ? 'boost_defense' :
        recipe.effect_type === 'boost_chance'  ? 'boost_chance' : null;

      if (boostCol) {
        // For boost_hp: also raise current_hp by the same amount (player gains the HP immediately)
        const hpHeal = boostCol === 'boost_hp'
          ? `, current_hp = LEAST(current_hp + $1, max_hp + boost_hp + $1)`
          : '';
        const champRows = await query(
          `UPDATE champions SET ${boostCol} = ${boostCol} + $1${hpHeal}
             WHERE id = $2 AND player_id = $3
           RETURNING *`,
          [recipe.effect_value, entity_id, playerId]
        );
        updatedChampion = champRows[0] ?? null;
      }
    }

    await query(
      `UPDATE player_food SET status='used', used_at=NOW() WHERE id=$1`,
      [foodId]
    );

    // Quest progress
    await incrementQuestProgress(playerId, 'kitchen_use');

    return res.json({
      boost: { ...boost, expires_at_ms: Number(boost.expires_at_ms) },
      food: { ...food, status: 'used' },
      champion: updatedChampion,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Use food failed' });
  }
});

// ─── GET /api/kitchen/boosts ─────────────────────────────────────────────────
// Returns player's currently active boosts (not expired).
// Optional query param: entity_id — filters to a specific champion or farmer.
router.get('/boosts', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { entity_id } = req.query;
  try {
    const params = [playerId];
    const entityFilter = entity_id ? `AND ab.entity_id = $2` : '';
    if (entity_id) params.push(entity_id);

    const rows = await query(
      `SELECT ab.*,
              EXTRACT(EPOCH FROM ab.expires_at)::BIGINT * 1000 AS expires_at_ms,
              r.name AS recipe_name, r.target AS recipe_target,
              r.effect_type AS recipe_effect_type, r.effect_value AS recipe_effect_value,
              r.effect_duration_minutes AS recipe_duration, r.tier AS recipe_tier,
              r.ingredients AS recipe_ingredients, r.cook_duration_minutes AS recipe_cook_duration
         FROM active_boosts ab
         LEFT JOIN recipes r ON r.id = ab.recipe_id
        WHERE ab.player_id = $1
          AND ab.expires_at > NOW()
          ${entityFilter}
        ORDER BY ab.expires_at ASC`,
      params
    );
    return res.json(rows.map(r => ({ ...r, expires_at_ms: Number(r.expires_at_ms) })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch boosts' });
  }
});

// ─── DELETE /api/kitchen/boosts/:boostId ─────────────────────────────────────
// Remove an active boost (player cancels food). Reverses champion.boost_* column
// if the boost was a fighter boost tied to a specific champion.
router.delete('/boosts/:boostId', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const { boostId } = req.params;

  try {
    const boosts = await query(
      `SELECT ab.*, r.effect_type AS r_effect_type, r.effect_value AS r_effect_value,
              r.target AS r_target
         FROM active_boosts ab
         LEFT JOIN recipes r ON r.id = ab.recipe_id
        WHERE ab.id = $1 AND ab.player_id = $2`,
      [boostId, playerId]
    );
    if (!boosts.length) return res.status(404).json({ error: 'Boost not found' });

    const boost = boosts[0];
    let updatedChampion = null;

    // Block removal while champion is on a dungeon mission or PvP battle
    if (boost.entity_id && boost.r_target === 'fighters') {
      const [activeRun] = await query(
        `SELECT id FROM dungeon_runs
          WHERE champion_id = $1 AND status = 'active' AND ends_at > NOW()`,
        [boost.entity_id]
      );
      if (activeRun) {
        return res.status(400).json({ error: 'Cannot remove food while champion is on a mission' });
      }
      const [pendingBattle] = await query(
        `SELECT id FROM pvp_battles
          WHERE attacker_champion_id = $1 AND status = 'pending'`,
        [boost.entity_id]
      );
      if (pendingBattle) {
        return res.status(400).json({ error: 'Cannot remove food while champion is in a PvP battle' });
      }
    }

    // Reverse the champion stat column for fighter boosts
    if (boost.entity_id && boost.r_target === 'fighters') {
      const effectType = boost.r_effect_type ?? boost.boost_type;
      const effectValue = boost.r_effect_value ?? boost.boost_value;
      const boostCol =
        effectType === 'boost_hp'      ? 'boost_hp' :
        effectType === 'boost_defense' ? 'boost_defense' :
        effectType === 'boost_chance'  ? 'boost_chance' : null;

      if (boostCol) {
        const champRows = await query(
          `UPDATE champions SET ${boostCol} = GREATEST(${boostCol} - $1, 0)
             WHERE id = $2 AND player_id = $3
           RETURNING *`,
          [effectValue, boost.entity_id, playerId]
        );
        updatedChampion = champRows[0] ?? null;
      }
    }

    await query(`DELETE FROM active_boosts WHERE id = $1`, [boostId]);

    return res.json({ success: true, champion: updatedChampion });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Remove boost failed' });
  }
});

module.exports = router;
