const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authMiddleware = require('../middleware/auth');
const { CAP_UPGRADE_COSTS, RESOURCE_CAP_START, RESOURCE_CAP_MAX, RESOURCE_CAP_STEP, getCapUpgradeCost } = require('../data/config/resource');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      'SELECT strawberry, pinecone, blueberry, strawberry_cap, pinecone_cap, blueberry_cap, egg, wool, milk, egg_cap, wool_cap, milk_cap FROM player_resources WHERE player_id = $1',
      [req.player.id]
    );
    if (!rows.length) {
      return res.json({ strawberry: 0, pinecone: 0, blueberry: 0, strawberry_cap: 10, pinecone_cap: 10, blueberry_cap: 10, egg: 0, wool: 0, milk: 0, egg_cap: 10, wool_cap: 10, milk_cap: 10 });
    }
    const row = rows[0];
    // Ensure caps have a value (in case columns were just added)
    return res.json({
      ...row,
      strawberry_cap: row.strawberry_cap ?? 10,
      pinecone_cap:   row.pinecone_cap   ?? 10,
      blueberry_cap:  row.blueberry_cap  ?? 10,
      egg:      row.egg      ?? 0,
      wool:     row.wool     ?? 0,
      milk:     row.milk     ?? 0,
      egg_cap:  row.egg_cap  ?? 10,
      wool_cap: row.wool_cap ?? 10,
      milk_cap: row.milk_cap ?? 10,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// POST /api/resources/upgrade-capacity — spend resources to raise one cap by 2
router.post('/upgrade-capacity', authMiddleware, async (req, res) => {
  const { resource } = req.body;
  if (!['strawberry', 'pinecone', 'blueberry'].includes(resource)) {
    return res.status(400).json({ error: 'Invalid resource' });
  }

  const playerId = req.player.id;
  const capCol  = `${resource}_cap`;
  const [costRes1, costRes2] = CAP_UPGRADE_COSTS[resource];

  try {
    const rows = await query('SELECT * FROM player_resources WHERE player_id = $1', [playerId]);
    if (!rows.length) return res.status(404).json({ error: 'Resources not found' });

    const playerRes = rows[0];
    const currentCap = playerRes[capCol] ?? RESOURCE_CAP_START;

    if (currentCap >= RESOURCE_CAP_MAX) {
      return res.status(400).json({ error: 'Maximum capacity reached' });
    }

    const cost = getCapUpgradeCost(currentCap);

    if ((playerRes[costRes1] ?? 0) < cost || (playerRes[costRes2] ?? 0) < cost) {
      return res.status(400).json({
        error: `Not enough resources (need ${cost} ${costRes1} + ${cost} ${costRes2})`,
        cost,
      });
    }

    await query(
      `UPDATE player_resources
         SET ${capCol}  = LEAST(${capCol} + ${RESOURCE_CAP_STEP}, ${RESOURCE_CAP_MAX}),
             ${costRes1} = ${costRes1} - $1,
             ${costRes2} = ${costRes2} - $2
       WHERE player_id = $3`,
      [cost, cost, playerId]
    );

    const updated = await query(
      'SELECT strawberry, pinecone, blueberry, strawberry_cap, pinecone_cap, blueberry_cap, egg, wool, milk, egg_cap, wool_cap, milk_cap FROM player_resources WHERE player_id = $1',
      [playerId]
    );
    return res.json(updated[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to upgrade capacity' });
  }
});

module.exports = router;
