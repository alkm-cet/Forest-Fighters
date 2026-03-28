const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { listDungeons, enterDungeon, getActiveRuns, claimRun } = require('../controllers/dungeonController');

router.get('/', authMiddleware, listDungeons);
router.get('/runs', authMiddleware, getActiveRuns);
router.post('/:id/enter', authMiddleware, enterDungeon);
router.post('/runs/:runId/claim', authMiddleware, claimRun);

module.exports = router;
