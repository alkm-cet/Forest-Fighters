const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const CHAMPION_FIELDS = 'id, name, class, level, xp, xp_to_next_level, attack, defense, chance, max_hp, current_hp, is_deployed, stat_points, boost_hp, boost_defense, boost_chance';

router.get('/', authMiddleware, async (req, res) => {
  try {
    let rows = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE player_id = $1 ORDER BY created_at ASC`,
      [req.player.id]
    );

    if (rows.length === 0) {
      const starters = [
        ['Oak Warrior', 'Warrior'],
        ['Forest Mage', 'Mage'],
        ['Pine Archer', 'Archer'],
      ];
      for (const [name, cls] of starters) {
        await query(
          'INSERT INTO champions (player_id, name, class, max_hp, current_hp) VALUES ($1, $2, $3, 100, 100)',
          [req.player.id, name, cls]
        );
      }
      rows = await query(
        `SELECT ${CHAMPION_FIELDS} FROM champions WHERE player_id = $1 ORDER BY created_at ASC`,
        [req.player.id]
      );
    }

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch champions' });
  }
});

// Revive a dead champion — costs 3 strawberries, restores to max HP
router.post('/:id/revive', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;
  const REVIVE_COST = 3;

  try {
    const champRows = await query(
      'SELECT id, current_hp, max_hp FROM champions WHERE id = $1 AND player_id = $2',
      [championId, playerId]
    );
    if (champRows.length === 0) return res.status(404).json({ error: 'Champion not found' });
    const champ = champRows[0];
    if (champ.current_hp > 0) return res.status(400).json({ error: 'Champion is not dead' });

    const resRows = await query('SELECT strawberry FROM player_resources WHERE player_id = $1', [playerId]);
    if (resRows.length === 0 || resRows[0].strawberry < REVIVE_COST) {
      return res.status(400).json({ error: `Not enough strawberries (need ${REVIVE_COST})` });
    }

    await query('UPDATE player_resources SET strawberry = strawberry - $1 WHERE player_id = $2', [REVIVE_COST, playerId]);
    await query('UPDATE champions SET current_hp = max_hp WHERE id = $1', [championId]);

    const updated = await query('SELECT strawberry FROM player_resources WHERE player_id = $1', [playerId]);
    res.json({ success: true, strawberry: updated[0].strawberry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Revive failed' });
  }
});

// Heal an injured champion — costs ceil(missingHp / 35) strawberries, restores to max HP
router.post('/:id/heal', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;

  try {
    const champRows = await query(
      'SELECT id, current_hp, max_hp, boost_hp FROM champions WHERE id = $1 AND player_id = $2',
      [championId, playerId]
    );
    if (champRows.length === 0) return res.status(404).json({ error: 'Champion not found' });
    const champ = champRows[0];
    const effectiveMaxHp = champ.max_hp + (champ.boost_hp || 0);
    if (champ.current_hp <= 0) return res.status(400).json({ error: 'Champion is dead, use revive' });
    if (champ.current_hp >= effectiveMaxHp) return res.status(400).json({ error: 'Champion is already at full HP' });

    const missingHp = effectiveMaxHp - champ.current_hp;
    const healCost = Math.ceil(missingHp / 35);

    const resRows = await query('SELECT strawberry FROM player_resources WHERE player_id = $1', [playerId]);
    if (resRows.length === 0 || resRows[0].strawberry < healCost) {
      return res.status(400).json({ error: `Not enough strawberries (need ${healCost})` });
    }

    await query('UPDATE player_resources SET strawberry = strawberry - $1 WHERE player_id = $2', [healCost, playerId]);
    await query('UPDATE champions SET current_hp = $1 WHERE id = $2', [effectiveMaxHp, championId]);

    const updated = await query('SELECT strawberry FROM player_resources WHERE player_id = $1', [playerId]);
    res.json({ success: true, strawberry: updated[0].strawberry, healCost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Heal failed' });
  }
});

// POST /:id/spend-stat — spend 1 stat point on attack, defense, or chance
router.post('/:id/spend-stat', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;
  const { stat } = req.body;

  if (!['attack', 'defense', 'chance'].includes(stat)) {
    return res.status(400).json({ error: 'Invalid stat. Must be attack, defense, or chance.' });
  }

  try {
    const rows = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1 AND player_id = $2`,
      [championId, playerId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Champion not found' });
    const champ = rows[0];

    if (champ.stat_points < 1) {
      return res.status(400).json({ error: 'No stat points available' });
    }

    await query(
      `UPDATE champions SET ${stat} = ${stat} + 1, stat_points = stat_points - 1 WHERE id = $1`,
      [championId]
    );

    const updated = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1`,
      [championId]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to spend stat point' });
  }
});

// POST /:id/boost — apply a one-battle boost to hp, defense, or chance
const BOOST_COSTS = {
  hp:      { resource: 'egg',  amount: 4 },
  defense: { resource: 'wool', amount: 3 },
  chance:  { resource: 'milk', amount: 3 },
};

router.post('/:id/boost', authMiddleware, async (req, res) => {
  const playerId = req.player.id;
  const championId = req.params.id;
  const { type } = req.body;

  if (!['hp', 'defense', 'chance'].includes(type)) {
    return res.status(400).json({ error: 'Invalid boost type. Must be hp, defense, or chance.' });
  }

  const { resource, amount } = BOOST_COSTS[type];
  const boostCol = `boost_${type}`;

  try {
    const champRows = await query(
      `SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1 AND player_id = $2`,
      [championId, playerId]
    );
    if (champRows.length === 0) return res.status(404).json({ error: 'Champion not found' });
    const champ = champRows[0];

    if (champ[boostCol] > 0) {
      return res.status(400).json({ error: 'Boost already active for this stat' });
    }

    const resRows = await query(`SELECT ${resource} FROM player_resources WHERE player_id = $1`, [playerId]);
    if (resRows.length === 0 || resRows[0][resource] < amount) {
      return res.status(400).json({ error: `Not enough ${resource} (need ${amount})` });
    }

    const boostValue = type === 'hp' ? 10 : 5;

    await query(`UPDATE player_resources SET ${resource} = ${resource} - $1 WHERE player_id = $2`, [amount, playerId]);
    if (type === 'hp') {
      // Increase current_hp by boostValue but never exceed (max_hp + boostValue)
      await query(
        `UPDATE champions SET ${boostCol} = $1, current_hp = LEAST(current_hp + $1, max_hp + $1) WHERE id = $2`,
        [boostValue, championId]
      );
    } else {
      await query(`UPDATE champions SET ${boostCol} = $1 WHERE id = $2`, [boostValue, championId]);
    }

    const updated = await query(`SELECT ${CHAMPION_FIELDS} FROM champions WHERE id = $1`, [championId]);
    const resUpdated = await query(`SELECT strawberry, pinecone, blueberry, strawberry_cap, pinecone_cap, blueberry_cap, egg, wool, milk, egg_cap, wool_cap, milk_cap FROM player_resources WHERE player_id = $1`, [playerId]);
    res.json({ champion: updated[0], resources: resUpdated[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Boost failed' });
  }
});

module.exports = router;
