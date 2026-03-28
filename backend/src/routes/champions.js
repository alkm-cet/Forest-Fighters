const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

const CHAMPION_FIELDS = 'id, name, class, level, xp, xp_to_next_level, attack, defense, chance, max_hp, current_hp, is_deployed, stat_points';

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
      'SELECT id, current_hp, max_hp FROM champions WHERE id = $1 AND player_id = $2',
      [championId, playerId]
    );
    if (champRows.length === 0) return res.status(404).json({ error: 'Champion not found' });
    const champ = champRows[0];
    if (champ.current_hp <= 0) return res.status(400).json({ error: 'Champion is dead, use revive' });
    if (champ.current_hp >= champ.max_hp) return res.status(400).json({ error: 'Champion is already at full HP' });

    const missingHp = champ.max_hp - champ.current_hp;
    const healCost = Math.ceil(missingHp / 35);

    const resRows = await query('SELECT strawberry FROM player_resources WHERE player_id = $1', [playerId]);
    if (resRows.length === 0 || resRows[0].strawberry < healCost) {
      return res.status(400).json({ error: `Not enough strawberries (need ${healCost})` });
    }

    await query('UPDATE player_resources SET strawberry = strawberry - $1 WHERE player_id = $2', [healCost, playerId]);
    await query('UPDATE champions SET current_hp = max_hp WHERE id = $1', [championId]);

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

module.exports = router;
