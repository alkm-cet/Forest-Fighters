const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  listDungeons,
  enterDungeon,
  getActiveRuns,
  claimRun,
  getAdventureProgress,
  getHarvestCooldowns,
  getMilestones,
  claimMilestone,
} = require('../controllers/dungeonController');

// Specific routes must be registered before /:id to avoid Express ambiguity
router.get('/adventure/progress', authMiddleware, getAdventureProgress);
router.get('/harvest/cooldowns', authMiddleware, getHarvestCooldowns);
router.get('/milestones', authMiddleware, getMilestones);
router.post('/milestones/:requiredStars/claim', authMiddleware, claimMilestone);

router.get('/', authMiddleware, listDungeons);
router.get('/runs', authMiddleware, getActiveRuns);
router.post('/:id/enter', authMiddleware, enterDungeon);
router.post('/runs/:runId/claim', authMiddleware, claimRun);

module.exports = router;
