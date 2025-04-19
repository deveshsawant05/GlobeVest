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
        [userId, toCurrency, 0, false]
      );
      toWalletId = newWalletResult.rows[0].wallet_id;
    } else {
      toWalletId = toWalletResult.rows[0].wallet_id;
    }
    
    // Get exchange rate from database
    let exchangeRate;
    const exchangeRateResult = await client.query(walletQueries.GET_EXCHANGE_RATE, [fromCurrency, toCurrency]);
    
    if (exchangeRateResult.rows.length > 0) {
      // Direct rate available
      exchangeRate = parseFloat(exchangeRateResult.rows[0].rate);
      logger.debug(`Direct exchange rate found: 1 ${fromCurrency} = ${exchangeRate} ${toCurrency}`);
    } else {
      // Try reverse rate
      const reverseRateResult = await client.query(walletQueries.GET_EXCHANGE_RATE, [toCurrency, fromCurrency]);
      
      if (reverseRateResult.rows.length > 0) {
        // Inverse of reverse rate
        exchangeRate = 1 / parseFloat(reverseRateResult.rows[0].rate);
        logger.debug(`Using inverse exchange rate: 1 ${fromCurrency} = ${exchangeRate} ${toCurrency}`);
      } else {
        // Try triangulation through USD as a base currency
        const fromToUsdResult = await client.query(walletQueries.GET_EXCHANGE_RATE, [fromCurrency, 'USD']);
        const usdToTargetResult = await client.query(walletQueries.GET_EXCHANGE_RATE, ['USD', toCurrency]);
        
        if (fromToUsdResult.rows.length > 0 && usdToTargetResult.rows.length > 0) {
          const fromToUsd = parseFloat(fromToUsdResult.rows[0].rate);
          const usdToTarget = parseFloat(usdToTargetResult.rows[0].rate);
          exchangeRate = fromToUsd * usdToTarget;
          logger.debug(`Using triangulated exchange rate via USD: 1 ${fromCurrency} = ${exchangeRate} ${toCurrency}`);
        } else {
          // Fallback rate if no exchange rate found
          throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
        }
      }
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

// Get user's total balance across all wallets
const getTotalBalance = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const selectedCurrency = req.query.currency;
    
    // First, get the user's master wallet to determine the base currency if no currency specified
    const masterWalletResult = await pool.query(walletQueries.GET_MASTER_WALLET, [userId]);
    
    if (masterWalletResult.rows.length === 0) {
      return res.status(404).json({ message: "Master wallet not found" });
    }
    
    const masterWallet = masterWalletResult.rows[0];
    const baseCurrency = selectedCurrency || masterWallet.currency_code;
    
    // Get the total value across all wallets converted to the chosen currency
    const totalResult = await pool.query(walletQueries.GET_TOTAL_WALLET_VALUE, [userId, baseCurrency]);
    
    res.json({
      totalBalance: parseFloat(totalResult.rows[0]?.total_balance || 0),
      currency: baseCurrency
    });
  } catch (error) {
    logger.error(`Error getting total balance: ${error.message}`);
    res.status(500).json({ message: "Error getting total balance" });
  }
};

// Get exchange rates
const getExchangeRates = async (req, res) => {
  try {
    logger.info('Fetching exchange rates from database');
    
    // Fetch all exchange rates from the database
    const exchangeRatesResult = await pool.query(walletQueries.GET_ALL_EXCHANGE_RATES);
    
    // Convert to flat format expected by frontend: USD_EUR, EUR_USD, etc.
    const flatRates = {};
    
    exchangeRatesResult.rows.forEach(rate => {
      flatRates[`${rate.from_currency}_${rate.to_currency}`] = parseFloat(rate.rate);
    });
    
    res.status(200).json(flatRates);
  } catch (error) {
    logger.error(`Error fetching exchange rates: ${error.message}`);
    res.status(500).json({ message: 'Failed to get exchange rates' });
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
  getTotalBalance,
  getExchangeRates
};
