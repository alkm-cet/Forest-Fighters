const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    let rows = await query(
      'SELECT id, name, class, level, attack, defense, chance, max_hp, current_hp, is_deployed FROM champions WHERE player_id = $1 ORDER BY created_at ASC',
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
        'SELECT id, name, class, level, attack, defense, chance, max_hp, current_hp, is_deployed FROM champions WHERE player_id = $1 ORDER BY created_at ASC',
        [req.player.id]
      );
    }

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch champions' });
  }
});

module.exports = router;
