const pool = require("../config/db");
const walletQueries = require('../queries/walletQueries');
const axios = require('axios');
const logger = require('../utils/logger');

// Get all wallets for a user
const getUserWallets = async (req, res) => {
  const userId = req.user.user_id;
  
  try {
    logger.info(`Fetching wallets for user ID: ${userId}`);
    const result = await pool.query(walletQueries.GET_USER_WALLETS, [userId]);
    logger.debug(`Retrieved ${result.rows.length} wallets for user`);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error retrieving user wallets: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving wallets' });
  }
};

// Get master wallet (home country currency)
const getMasterWallet = async (req, res) => {
  const userId = req.user.user_id;
  const { currencyCode } = req.params;
  
  try {
    logger.info(`Fetching master wallet for user ID: ${userId} with currency: ${currencyCode}`);
    const result = await pool.query(walletQueries.GET_MASTER_WALLET, [userId, currencyCode]);
    
    if (result.rows.length === 0) {
      logger.warn(`Master wallet not found for user ID: ${userId} with currency: ${currencyCode}`);
      return res.status(404).json({ message: 'Master wallet not found' });
    }
    
    logger.debug(`Retrieved master wallet with balance: ${result.rows[0].balance}`);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error retrieving master wallet: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving master wallet' });
  }
};

// Get foreign wallets
const getForeignWallets = async (req, res) => {
  const userId = req.user.user_id;
  const { masterCurrency } = req.params;
  
  try {
    logger.info(`Fetching foreign wallets for user ID: ${userId} (excluding ${masterCurrency})`);
    const result = await pool.query(walletQueries.GET_FOREIGN_WALLETS, [userId, masterCurrency]);
    logger.debug(`Retrieved ${result.rows.length} foreign wallets for user`);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error retrieving foreign wallets: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving foreign wallets' });
  }
};

// Create a new wallet
const createWallet = async (req, res) => {
  const userId = req.user.user_id;
  const { currencyCode, initialBalance = 0, isMaster = false } = req.body;
  
  if (!currencyCode) {
    logger.warn('Missing currency code for wallet creation');
    return res.status(400).json({ message: 'Currency code is required' });
  }
  
  // Start transaction to ensure atomic operations
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info(`Creating wallet for user ID: ${userId}, currency: ${currencyCode}`);
    
    // Check if wallet already exists
    const checkResult = await client.query(walletQueries.CHECK_WALLET_EXISTS, [userId, currencyCode]);
    if (parseInt(checkResult.rows[0].count) > 0) {
      logger.warn(`Wallet already exists for user ID: ${userId}, currency: ${currencyCode}`);
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Wallet for this currency already exists' });
    }
    
    // If this is the master wallet, check if any other master wallets already exist
    if (isMaster) {
      const masterWalletCheck = await client.query(walletQueries.GET_MASTER_WALLET, [userId]);
      if (masterWalletCheck.rows.length > 0) {
        logger.warn(`Master wallet already exists for user ID: ${userId}`);
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Master wallet already exists' });
      }
    }
    
    // If this is the first wallet for the user, make it the master wallet
    if (!isMaster) {
      const walletsCount = await client.query('SELECT COUNT(*) FROM wallets WHERE user_id = $1', [userId]);
      if (parseInt(walletsCount.rows[0].count) === 0) {
        isMaster = true;
        logger.info(`Setting first wallet as master wallet for user ID: ${userId}`);
      }
    }
    
    // Create wallet
    const result = await client.query(
      walletQueries.CREATE_WALLET,
      [userId, currencyCode, initialBalance, isMaster]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Wallet created successfully: ${result.rows[0].wallet_id}`);
    res.status(201).json({
      message: 'Wallet created successfully',
      wallet: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error creating wallet: ${error.message}`);
    res.status(500).json({ message: 'Server error creating wallet' });
  } finally {
    client.release();
  }
};

// Deposit funds into wallet
const depositFunds = async (req, res) => {
  const userId = req.user.user_id;
  const { currencyCode, amount } = req.body;
  
  if (!currencyCode || !amount) {
    logger.warn('Missing required fields for deposit');
    return res.status(400).json({ message: 'Currency code and amount are required' });
  }
  
  if (parseFloat(amount) <= 0) {
    logger.warn(`Invalid deposit amount: ${amount}`);
    return res.status(400).json({ message: 'Deposit amount must be greater than 0' });
  }
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.info(`Starting deposit transaction for user ID: ${userId}, currency: ${currencyCode}, amount: ${amount}`);
    
    // Check if wallet exists
    const checkResult = await client.query(walletQueries.CHECK_WALLET_EXISTS, [userId, currencyCode]);
    if (parseInt(checkResult.rows[0].count) === 0) {
      // Wallet doesn't exist - create it as a master wallet if no master wallet exists yet
      const masterWalletCheck = await client.query(walletQueries.GET_MASTER_WALLET, [userId]);
      const isMaster = masterWalletCheck.rows.length === 0;
      
      logger.info(`Creating ${isMaster ? 'master' : 'regular'} wallet for currency: ${currencyCode}`);
      await client.query(walletQueries.CREATE_WALLET, [userId, currencyCode, 0, isMaster]);
    }
    
    // Get wallet info including is_master status
    const walletInfo = await client.query(walletQueries.GET_WALLET_BY_CURRENCY, [userId, currencyCode]);
    
    // Only allow deposits to master wallet
    if (!walletInfo.rows[0].is_master) {
      await client.query('ROLLBACK');
      logger.warn(`Deposit rejected: Attempted to deposit into non-master wallet ${currencyCode}`);
      return res.status(400).json({ 
        message: 'Deposits are only allowed to the master wallet. Use currency exchange for other wallets.' 
      });
    }
    
    // Update wallet balance
    const depositResult = await client.query(
      walletQueries.DEPOSIT_FUNDS, 
      [currencyCode, amount, userId]
    );
    
    if (depositResult.rows.length === 0) {
      throw new Error('Deposit failed - wallet not found');
    }
    
    // Record transaction
    await client.query(
      'INSERT INTO transactions (user_id, wallet_id, transaction_type, amount) VALUES ($1, $2, $3, $4)',
      [userId, depositResult.rows[0].wallet_id, 'deposit', amount]
    );
    
    await client.query('COMMIT');
    logger.info(`Deposit successful: ${amount} ${currencyCode}`);
    
    res.status(200).json({
      message: 'Deposit successful',
      balance: depositResult.rows[0].balance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error depositing funds: ${error.message}`);
    res.status(500).json({ message: 'Server error depositing funds' });
  } finally {
    client.release();
  }
};

// Withdraw funds from wallet
const withdrawFunds = async (req, res) => {
  const userId = req.user.user_id;
  const { currencyCode, amount } = req.body;
  
  if (!currencyCode || !amount) {
    logger.warn('Missing required fields for withdrawal');
    return res.status(400).json({ message: 'Currency code and amount are required' });
  }
  
  if (parseFloat(amount) <= 0) {
    logger.warn(`Invalid withdrawal amount: ${amount}`);
    return res.status(400).json({ message: 'Withdrawal amount must be greater than 0' });
  }
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.info(`Starting withdrawal transaction for user ID: ${userId}, currency: ${currencyCode}, amount: ${amount}`);
    
    // Check if wallet exists and get its details
    const walletInfo = await client.query(walletQueries.GET_WALLET_BY_CURRENCY, [userId, currencyCode]);
    
    if (walletInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.warn(`Withdrawal rejected: Wallet not found for currency ${currencyCode}`);
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    const wallet = walletInfo.rows[0];
    
    // Only allow withdrawals from master wallet
    if (!wallet.is_master) {
      await client.query('ROLLBACK');
      logger.warn(`Withdrawal rejected: Attempted to withdraw from non-master wallet ${currencyCode}`);
      return res.status(400).json({ 
        message: 'Withdrawals are only allowed from the master wallet' 
      });
    }
    
    // Check if enough balance
    if (parseFloat(wallet.balance) < parseFloat(amount)) {
      await client.query('ROLLBACK');
      logger.warn(`Withdrawal rejected: Insufficient funds. Requested: ${amount}, Available: ${wallet.balance}`);
      return res.status(400).json({ 
        message: `Insufficient funds. Available balance: ${wallet.balance} ${currencyCode}`
      });
    }
    
    // Update wallet balance by subtracting the amount
    const withdrawalResult = await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND currency_code = $3 RETURNING *',
      [amount, userId, currencyCode]
    );
    
    // Record transaction
    await client.query(
      'INSERT INTO transactions (user_id, wallet_id, transaction_type, amount) VALUES ($1, $2, $3, $4)',
      [userId, wallet.wallet_id, 'withdrawal', amount]
    );
    
    await client.query('COMMIT');
    logger.info(`Withdrawal successful: ${amount} ${currencyCode}`);
    
    res.status(200).json({
      message: 'Withdrawal successful',
      balance: withdrawalResult.rows[0].balance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error withdrawing funds: ${error.message}`);
    res.status(500).json({ message: 'Server error withdrawing funds' });
  } finally {
    client.release();
  }
};

// Exchange currency between wallets
const exchangeCurrency = async (req, res) => {
  const userId = req.user.user_id;
  const { fromCurrency, toCurrency, amount } = req.body;
  
  if (!fromCurrency || !toCurrency || !amount) {
    logger.warn('Missing required fields for currency exchange');
    return res.status(400).json({ 
      message: 'From currency, to currency, and amount are required' 
    });
  }
  
  if (parseFloat(amount) <= 0) {
    logger.warn(`Invalid exchange amount: ${amount}`);
    return res.status(400).json({ message: 'Exchange amount must be greater than 0' });
  }
  
  if (fromCurrency === toCurrency) {
    logger.warn('Cannot exchange to the same currency');
    return res.status(400).json({ message: 'From and to currencies must be different' });
  }
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.info(`Starting currency exchange: ${amount} ${fromCurrency} to ${toCurrency}`);
    
    // Check if from wallet exists and has sufficient funds
    const fromWalletResult = await client.query(
      'SELECT wallet_id, balance FROM wallets WHERE user_id = $1 AND currency_code = $2',
      [userId, fromCurrency]
    );
    
    if (fromWalletResult.rows.length === 0) {
      throw new Error(`Wallet for ${fromCurrency} not found`);
    }
    
    const fromWallet = fromWalletResult.rows[0];
    if (parseFloat(fromWallet.balance) < parseFloat(amount)) {
      throw new Error(`Insufficient funds in ${fromCurrency} wallet`);
    }
    
    // Check if to wallet exists, create if not
    const toWalletResult = await client.query(
      'SELECT wallet_id FROM wallets WHERE user_id = $1 AND currency_code = $2',
      [userId, toCurrency]
    );
    
    let toWalletId;
    if (toWalletResult.rows.length === 0) {
      // Create destination wallet
      const newWalletResult = await client.query(
        walletQueries.CREATE_WALLET,
        [userId, toCurrency, 0]
      );
      toWalletId = newWalletResult.rows[0].wallet_id;
    } else {
      toWalletId = toWalletResult.rows[0].wallet_id;
    }
    
    // Get exchange rate
    // In a real app, you would use a forex API. For demo purposes, we'll use a mock API
    let exchangeRate;
    try {
      // For demonstration - in a real app you would use a service like:
      // const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
      // exchangeRate = response.data.rates[toCurrency];
      
      // Mock exchange rates for demo
      const mockRates = {
        'USD': { 'EUR': 0.92, 'GBP': 0.79, 'JPY': 150.44, 'INR': 83.12 },
        'EUR': { 'USD': 1.09, 'GBP': 0.86, 'JPY': 163.57, 'INR': 90.28 },
        'GBP': { 'USD': 1.27, 'EUR': 1.17, 'JPY': 191.13, 'INR': 105.66 },
        'JPY': { 'USD': 0.0067, 'EUR': 0.0061, 'GBP': 0.0052, 'INR': 0.55 },
        'INR': { 'USD': 0.012, 'EUR': 0.011, 'GBP': 0.0095, 'JPY': 1.81 }
      };
      
      exchangeRate = mockRates[fromCurrency]?.[toCurrency];
      if (!exchangeRate) {
        // Fallback rate if currency pair not in mock data
        exchangeRate = 1.0;
      }
      
      logger.debug(`Exchange rate: 1 ${fromCurrency} = ${exchangeRate} ${toCurrency}`);
    } catch (error) {
      throw new Error(`Could not get exchange rate: ${error.message}`);
    }
    
    const convertedAmount = parseFloat(amount) * exchangeRate;
    logger.debug(`Converting ${amount} ${fromCurrency} to ${convertedAmount.toFixed(4)} ${toCurrency}`);
    
    // Update from wallet (decrease balance)
    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE wallet_id = $2',
      [amount, fromWallet.wallet_id]
    );
    
    // Update to wallet (increase balance)
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE wallet_id = $2',
      [convertedAmount, toWalletId]
    );
    
    // Record transaction for from wallet
    await client.query(
      'INSERT INTO transactions (user_id, wallet_id, transaction_type, amount) VALUES ($1, $2, $3, $4)',
      [userId, fromWallet.wallet_id, 'conversion', amount]
    );
    
    // Record transaction for to wallet
    await client.query(
      'INSERT INTO transactions (user_id, wallet_id, transaction_type, amount) VALUES ($1, $2, $3, $4)',
      [userId, toWalletId, 'conversion', convertedAmount]
    );
    
    await client.query('COMMIT');
    logger.info('Currency exchange completed successfully');
    
    res.status(200).json({
      message: 'Currency exchange successful',
      fromAmount: amount,
      toAmount: convertedAmount.toFixed(4),
      exchangeRate: exchangeRate.toFixed(4),
      fromCurrency,
      toCurrency
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error exchanging currency: ${error.message}`);
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Get wallet balance total across all currencies
const getTotalBalance = async (req, res) => {
  const userId = req.user.user_id;
  
  try {
    logger.info(`Calculating total wallet value for user ID: ${userId}`);
    
    // First check if exchange_rates table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'exchange_rates'
      )
    `);
    
    const exchangeRatesExist = tableCheck.rows[0].exists;
    
    if (!exchangeRatesExist) {
      // If exchange_rates table doesn't exist, just sum up the wallet balances without conversion
      logger.warn('Exchange rates table not found, calculating without conversions');
      const simpleResult = await pool.query(`
        SELECT SUM(balance) as total_balance 
        FROM wallets 
        WHERE user_id = $1
      `, [userId]);
      
      const totalBalance = simpleResult.rows[0]?.total_balance || 0;
      logger.debug(`Total wallet value (without conversion): ${totalBalance}`);
      return res.status(200).json({ totalBalance });
    }
    
    // Otherwise, use the conversion query 
    const masterWalletResult = await pool.query(walletQueries.GET_MASTER_WALLET, [userId]);
    const baseCurrency = masterWalletResult.rows.length > 0 
      ? masterWalletResult.rows[0].currency_code 
      : 'USD';
    
    const result = await pool.query(walletQueries.GET_TOTAL_WALLET_VALUE, [userId, baseCurrency]);
    const totalBalance = result.rows[0]?.total_balance || 0;
    
    logger.debug(`Total wallet value: ${totalBalance}`);
    res.status(200).json({ totalBalance });
  } catch (error) {
    logger.error(`Error calculating total wallet value: ${error.message}`);
    // Return a fallback value of the current wallet balance without conversion
    try {
      const fallbackResult = await pool.query(`
        SELECT SUM(balance) as total_balance 
        FROM wallets 
        WHERE user_id = $1
      `, [userId]);
      
      const totalBalance = fallbackResult.rows[0]?.total_balance || 0;
      logger.warn(`Falling back to simple sum: ${totalBalance}`);
      res.status(200).json({ totalBalance });
    } catch (fallbackError) {
      res.status(500).json({ 
        message: 'Server error calculating total wallet value',
        totalBalance: 0
      });
    }
  }
};

module.exports = {
  getUserWallets,
  getMasterWallet,
  getForeignWallets,
  createWallet,
  depositFunds,
  withdrawFunds,
  exchangeCurrency,
  getTotalBalance
};
