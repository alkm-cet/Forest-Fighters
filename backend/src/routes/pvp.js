const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { attackPvp, getPvpStatus, getBattles, getHistory, setDefender, findOpponent } = require('../controllers/pvpController');

router.post('/attack',          authMiddleware, attackPvp);
router.get('/status',           authMiddleware, getPvpStatus);
router.get('/battles',          authMiddleware, getBattles);
router.get('/history',          authMiddleware, getHistory);
router.post('/set-defender',    authMiddleware, setDefender);
router.get('/find-opponent',    authMiddleware, findOpponent);

module.exports = router;
