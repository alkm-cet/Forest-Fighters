const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      'SELECT strawberry, pinecone, blueberry FROM player_resources WHERE player_id = $1',
      [req.player.id]
    );
    if (!rows.length) {
      return res.json({ strawberry: 0, pinecone: 0, blueberry: 0 });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

module.exports = router;
