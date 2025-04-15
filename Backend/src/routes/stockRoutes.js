const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/markets/:market', stockController.getStocksByMarket);
router.get('/:stockId/history', stockController.getStockHistory);
router.get('/:stockId', stockController.getStockById);
router.get('/', stockController.getAllStocks);

// Protected routes (require authentication)
router.use(authenticateToken);
router.get('/user/portfolio', stockController.getUserPortfolio);

module.exports = router; 