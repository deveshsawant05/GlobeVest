const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/auth');

// All transaction routes require authentication
router.use(authenticateToken);

// Get all transactions
router.get('/', transactionController.getUserTransactions);

// Get transactions by type
router.get('/type/:type', transactionController.getTransactionsByType);

// Get transaction statistics (for dashboard)
router.get('/stats', transactionController.getTransactionStats);

module.exports = router; 