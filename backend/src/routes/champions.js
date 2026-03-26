const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, class, level, attack, defense, chance, is_deployed FROM champions WHERE player_id = $1 ORDER BY created_at ASC',
      [req.player.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch champions' });
  }
});

module.exports = router;
