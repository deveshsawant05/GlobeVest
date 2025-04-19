const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/auth');

// All wallet routes require authentication
router.use(authenticateToken);

// Get all wallets
router.get('/', walletController.getUserWallets);

// Get master wallet
router.get('/master/:currencyCode', walletController.getMasterWallet);

// Get foreign wallets
router.get('/foreign/:masterCurrency', walletController.getForeignWallets);

// Create a new wallet
router.post('/', walletController.createWallet);

// Deposit funds
router.post('/deposit', walletController.depositFunds);

// Withdraw funds
router.post('/withdraw', walletController.withdrawFunds);

// Currency exchange
router.post('/exchange', walletController.exchangeCurrency);

// Get total balance
router.get('/balance/total', walletController.getTotalBalance);

// Get exchange rates
router.get('/exchange-rates', walletController.getExchangeRates);

module.exports = router;
