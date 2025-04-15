const express = require('express');
const router = express.Router();
const tradeController = require('../controllers/tradeController');
const { authenticateToken } = require('../middleware/auth');

// All trade routes require authentication
router.use(authenticateToken);

// Get user's trades
router.get('/', tradeController.getUserTrades);

// Get trades by type (buy/sell)
router.get('/type/:type', tradeController.getTradesByType);

// Get user's investment value
router.get('/investment-value', tradeController.getUserInvestmentValue);

// Execute trades
router.post('/buy', tradeController.executeBuyTrade);
router.post('/sell', tradeController.executeSellTrade);

module.exports = router; 