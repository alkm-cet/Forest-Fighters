const express = require("express");
const router = express.Router();
const { query } = require("../db");
const authMiddleware = require("../middleware/auth");
const { getChampionGearBonuses } = require("./gear");
const { CLASS_STATS, STARTER_CHAMPIONS } = require("../data/content/starterChampions");
const { getLocalizedField } = require("../data/helpers/i18n");

const CHAMPION_FIELDS =
  "id, name, class, level, xp, xp_to_next_level, attack, defense, chance, max_hp, current_hp, is_deployed, stat_points, boost_hp, boost_defense, boost_chance, boost_attack, last_defender";

// Boost columns computed live from active_boosts so expired timed boosts return 0 immediately.
const CHAMPION_LIVE_SELECT = `
  SELECT c.id, c.name, c.class, c.level, c.xp, c.xp_to_next_level,
         c.attack, c.defense, c.chance, c.max_hp, c.current_hp,
         c.is_deployed, c.stat_points, c.last_defender,
    (SELECT COALESCE(SUM(boost_value),0)::int FROM active_boosts WHERE entity_id = c.id AND boost_type = 'boost_hp'      AND expires_at > NOW()) AS boost_hp,
    (SELECT COALESCE(SUM(boost_value),0)::int FROM active_boosts WHERE entity_id = c.id AND boost_type = 'boost_defense' AND expires_at > NOW()) AS boost_defense,
    (SELECT COALESCE(SUM(boost_value),0)::int FROM active_boosts WHERE entity_id = c.id AND boost_type = 'boost_chance'  AND expires_at > NOW()) AS boost_chance,
    (SELECT COALESCE(SUM(boost_value),0)::int FROM active_boosts WHERE entity_id = c.id AND boost_type = 'boost_attack'  AND expires_at > NOW()) AS boost_attack
  FROM champions c
`;

router.get("/", authMiddleware, async (req, res) => {
  try {
    let rows = await query(
      `${CHAMPION_LIVE_SELECT} WHERE c.player_id = $1 ORDER BY c.created_at ASC`,
      [req.player.id],
    );

    if (rows.length === 0) {
      for (const c of STARTER_CHAMPIONS) {
        const cName = getLocalizedField(c.name, "en");
        const s = CLASS_STATS[c.class];
        await query(
          "INSERT INTO champions (player_id, name, class, attack, defense, chance, max_hp, current_hp) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)",
          [req.player.id, cName, c.class, s.attack, s.defense, s.chance, s.max_hp],
        );
      }
      rows = await query(
        `${CHAMPION_LIVE_SELECT} WHERE c.player_id = $1 ORDER BY c.created_at ASC`,
        [req.player.id],
      );
    }

    // Attach gear bonuses (capped at 50% of each base stat) to each champion
    const withGear = await Promise.all(
      rows.map(async (champ) => {
        const raw = await getChampionGearBonuses(champ.id);
        return {
          ...champ,
          gear_attack: Math.min(raw.attack, Math.floor(champ.attack * 0.5)),
          gear_defense: Math.min(raw.defense, Math.floor(champ.defense * 0.5)),
          gear_chance: Math.min(raw.chance, Math.floor(champ.chance * 0.5)),
        };
      }),
    );

    return res.json(withGear);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch champions" });
  }
});

// Revive a dead champion — costs 4 milk + 4 wool, restores to max HP
router.post("/:id/revive", authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;

  try {
    const champRows = await query(
      "SELECT id, current_hp, max_hp, level FROM champions WHERE id = $1 AND player_id = $2",
      [championId, playerId],
    );

    if (champRows.length === 0) {
      return res.status(404).json({ error: "Champion not found" });
    }

    const champ = champRows[0];

    if (champ.current_hp > 0) {
      return res.status(400).json({ error: "Champion is not dead" });
    }

    const MILK_COST = 5 + champ.level;
    const WOOL_COST = 5 + champ.level;

    const resRows = await query(
      "SELECT milk, wool FROM player_resources WHERE player_id = $1",
      [playerId],
    );

    if (
      resRows.length === 0 ||
      resRows[0].milk < MILK_COST ||
      resRows[0].wool < WOOL_COST
    ) {
      return res.status(400).json({
        error: `Not enough resources (need ${MILK_COST} milk + ${WOOL_COST} wool)`,
      });
    }

    await query(
      `UPDATE player_resources 
       SET 
         milk = GREATEST(milk - $1, 0), 
         wool = GREATEST(wool - $2, 0)
       WHERE player_id = $3`,
      [MILK_COST, WOOL_COST, playerId],
    );

    await query("UPDATE champions SET current_hp = max_hp WHERE id = $1", [
      championId,
    ]);

    const updated = await query(
      "SELECT milk, wool FROM player_resources WHERE player_id = $1",
      [playerId],
    );

    res.json({
      success: true,
      milk: updated[0].milk,
      wool: updated[0].wool,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Revive failed" });
  }
});

// Heal an injured champion — costs 2 milk + 2 egg, restores +20 HP (capped at max)
router.post("/:id/heal", authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;
  const MILK_COST = 5;
  const EGG_COST = 5;
  const HEAL_AMOUNT = 20;

  try {
    const champRows = await query(
      "SELECT id, current_hp, max_hp, boost_hp FROM champions WHERE id = $1 AND player_id = $2",
      [championId, playerId],
    );
    if (champRows.length === 0)
      return res.status(404).json({ error: "Champion not found" });
    const champ = champRows[0];
    const effectiveMaxHp = champ.max_hp + (champ.boost_hp || 0);
    if (champ.current_hp <= 0)
      return res.status(400).json({ error: "Champion is dead, use revive" });
    if (champ.current_hp >= effectiveMaxHp)
      return res.status(400).json({ error: "Champion is already at full HP" });

    const resRows = await query(
      "SELECT milk, egg FROM player_resources WHERE player_id = $1",
      [playerId],
    );
    if (
      resRows.length === 0 ||
      resRows[0].milk < MILK_COST ||
      resRows[0].egg < EGG_COST
    ) {
      return res.status(400).json({
        error: `Not enough resources (need ${MILK_COST} milk + ${EGG_COST} egg)`,
      });
    }

    const newHp = Math.round(
      Math.min(champ.current_hp + HEAL_AMOUNT, effectiveMaxHp),
    );
    await query(
      "UPDATE player_resources SET milk = GREATEST(milk - $1, 0), egg = GREATEST(egg - $2, 0) WHERE player_id = $3",
      [MILK_COST, EGG_COST, playerId],
    );
    await query("UPDATE champions SET current_hp = $1 WHERE id = $2", [
      newHp,
      championId,
    ]);

    const updated = await query(
      "SELECT milk, egg FROM player_resources WHERE player_id = $1",
      [playerId],
    );
    res.json({
      success: true,
      milk: updated[0].milk,
      egg: updated[0].egg,
      newHp,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Heal failed" });
  }
});

// POST /:id/spend-stat — spend 1 stat point on attack, defense, or chance
router.post("/:id/spend-stat", authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;
  const { stat } = req.body;

  if (!["attack", "defense", "chance"].includes(stat)) {
    return res
      .status(400)
      .json({ error: "Invalid stat. Must be attack, defense, or chance." });
  }

  try {
    const rows = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1 AND player_id = $2`,
      [championId, playerId],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Champion not found" });
    const champ = rows[0];

    if (champ.stat_points < 1) {
      return res.status(400).json({ error: "No stat points available" });
    }

    await query(
      `UPDATE champions SET ${stat} = ${stat} + 1, stat_points = stat_points - 1 WHERE id = $1`,
      [championId],
    );

    const updated = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1`,
      [championId],
    );
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to spend stat point" });
  }
});

// POST /:id/boost — apply a one-battle boost to hp, defense, or chance
const BOOST_COSTS = {
  hp: { resource: "egg", amount: 4 },
  defense: { resource: "wool", amount: 3 },
  chance: { resource: "milk", amount: 3 },
};

router.post("/:id/boost", authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;
  const { type } = req.body;

  if (!["hp", "defense", "chance"].includes(type)) {
    return res
      .status(400)
      .json({ error: "Invalid boost type. Must be hp, defense, or chance." });
  }

  const { resource, amount } = BOOST_COSTS[type];
  const boostCol = `boost_${type}`;

  try {
    const champRows = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1 AND player_id = $2`,
      [championId, playerId],
    );
    if (champRows.length === 0)
      return res.status(404).json({ error: "Champion not found" });
    const champ = champRows[0];

    if (champ[boostCol] > 0) {
      return res
        .status(400)
        .json({ error: "Boost already active for this stat" });
    }

    const resRows = await query(
      `SELECT ${resource} FROM player_resources WHERE player_id = $1`,
      [playerId],
    );
    if (resRows.length === 0 || resRows[0][resource] < amount) {
      return res
        .status(400)
        .json({ error: `Not enough ${resource} (need ${amount})` });
    }

    const boostValue = type === "hp" ? 10 : 5;

    await query(
      `UPDATE player_resources SET ${resource} = ${resource} - $1 WHERE player_id = $2`,
      [amount, playerId],
    );
    if (type === "hp") {
      // Increase current_hp by boostValue but never exceed (max_hp + boostValue)
      await query(
        `UPDATE champions SET ${boostCol} = $1, current_hp = LEAST(current_hp + $1, max_hp + $1) WHERE id = $2`,
        [boostValue, championId],
      );
    } else {
      await query(`UPDATE champions SET ${boostCol} = $1 WHERE id = $2`, [
        boostValue,
        championId,
      ]);
    }

    const updated = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1`,
      [championId],
    );
    const resUpdated = await query(
      `SELECT strawberry, pinecone, blueberry, strawberry_cap, pinecone_cap, blueberry_cap, egg, wool, milk, egg_cap, wool_cap, milk_cap FROM player_resources WHERE player_id = $1`,
      [playerId],
    );
    res.json({ champion: updated[0], resources: resUpdated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Boost failed" });
  }
});

module.exports = router;
