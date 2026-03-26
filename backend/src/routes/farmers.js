const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    let rows = await query(
      'SELECT id, name, resource_type, production_rate, level, last_collected_at FROM farmers WHERE player_id = $1 ORDER BY resource_type ASC',
      [req.player.id]
    );

    if (rows.length === 0) {
      const starters = [
        ['Strawberry Farmer', 'strawberry'],
        ['Pinecone Farmer', 'pinecone'],
        ['Blueberry Farmer', 'blueberry'],
      ];
      for (const [name, type] of starters) {
        await query(
          'INSERT INTO farmers (player_id, name, resource_type) VALUES ($1, $2, $3)',
          [req.player.id, name, type]
        );
      }
      rows = await query(
        'SELECT id, name, resource_type, production_rate, level, last_collected_at FROM farmers WHERE player_id = $1 ORDER BY resource_type ASC',
        [req.player.id]
      );
    }

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch farmers' });
  }
});

module.exports = router;
