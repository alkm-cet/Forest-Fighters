const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { LEAGUE_TIERS } = require('../data/config/pvp');

function getLeague(trophies) {
  for (const tier of LEAGUE_TIERS) {
    if (trophies >= tier.min) return tier.name;
  }
  return 'Bronz';
}

// GET /api/players/leaderboard — top 50 real players sorted by trophies
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        p.id,
        p.username,
        p.trophies,
        COALESCE(MAX(c.level), 0) AS highest_champion_level
      FROM players p
      LEFT JOIN champions c ON c.player_id = p.id
      GROUP BY p.id, p.username, p.trophies
      ORDER BY p.trophies DESC
      LIMIT 50
    `);

    return res.json(rows.map((r) => ({
      id:                     r.id,
      username:               r.username,
      trophies:               r.trophies,
      league:                 getLeague(r.trophies),
      highest_champion_level: parseInt(r.highest_champion_level) || 0,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
