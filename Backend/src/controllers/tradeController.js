const pool = require('../config/db');
const tradeQueries = require('../queries/tradeQueries');
const stockQueries = require('../queries/stockQueries');
const walletQueries = require('../queries/walletQueries');

// Logging utility
const log = (level, message) => {
  switch (level) {
    case 'debug':
      console.log(`[DEBUG] ${message}`);
      break;
    case 'error':
      console.error(`[ERROR] ${message}`);
      break;
    case 'info':
      console.info(`[INFO] ${message}`);
      break;
    case 'warn':
      console.warn(`[WARN] ${message}`);
      break;
    default:
      console.log(message);
  }
};

// Get user's trades with pagination
const getUserTrades = async (req, res) => {
  const userId = req.user.user_id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  try {
    log('info', `Fetching trades for user ID: ${userId}, page: ${page}, limit: ${limit}`);
    
    const trades = await pool.query(tradeQueries.GET_USER_TRADES, [userId, limit, offset]);
    const countResult = await pool.query(tradeQueries.GET_TRADE_COUNT, [userId]);
    const totalTrades = parseInt(countResult.rows[0].total);
    
    log('debug', `Retrieved ${trades.rows.length} trades for user`);
    
    res.status(200).json({
      trades: trades.rows,
      pagination: {
        total: totalTrades,
        page,
        limit,
        pages: Math.ceil(totalTrades / limit)
      }
    });
  } catch (error) {
    log('error', `Error retrieving user trades: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving trades' });
  }
};

// Get user's trades by type (buy/sell) with pagination
const getTradesByType = async (req, res) => {
  const userId = req.user.user_id;
  const { type } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  // Validate trade type
  if (type !== 'buy' && type !== 'sell') {
    return res.status(400).json({ message: 'Invalid trade type. Must be "buy" or "sell"' });
  }
  
  try {
    log('info', `Fetching ${type} trades for user ID: ${userId}, page: ${page}, limit: ${limit}`);
    
    const trades = await pool.query(tradeQueries.GET_TRADES_BY_TYPE, [userId, type, limit, offset]);
    
    // Count total trades of this type
    const countQuery = `
      SELECT COUNT(*) as total
      FROM trades
      WHERE user_id = $1 AND trade_type = $2
    `;
    const countResult = await pool.query(countQuery, [userId, type]);
    const totalTrades = parseInt(countResult.rows[0].total);
    
    log('debug', `Retrieved ${trades.rows.length} ${type} trades for user`);
    
    res.status(200).json({
      trades: trades.rows,
      pagination: {
        total: totalTrades,
        page,
        limit,
        pages: Math.ceil(totalTrades / limit)
      }
    });
  } catch (error) {
    log('error', `Error retrieving ${type} trades: ${error.message}`);
    res.status(500).json({ message: `Server error retrieving ${type} trades` });
  }
};

// Get user's investment value
const getUserInvestmentValue = async (req, res) => {
  const userId = req.user.user_id;
  
  try {
    log('info', `Calculating investment value for user ID: ${userId}`);
    
    const result = await pool.query(tradeQueries.GET_USER_INVESTMENT_VALUE, [userId]);
    const totalValue = result.rows[0]?.total_value || 0;
    
    log('debug', `User investment value: ${totalValue}`);
    
    res.status(200).json({ totalValue });
  } catch (error) {
    log('error', `Error calculating investment value: ${error.message}`);
    res.status(500).json({ message: 'Server error calculating investment value' });
  }
};

// Execute a buy trade
const executeBuyTrade = async (req, res) => {
  const userId = req.user.user_id;
  const { stockId, quantity, walletId } = req.body;
  
  console.log("Buy trade request body:", req.body);
  
  // Validate required fields
  if (!stockId) {
    log('warn', 'Missing stockId for buy trade');
    return res.status(400).json({ message: 'Missing required field: stockId' });
  }
  
  if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
    log('warn', 'Missing or invalid quantity for buy trade');
    return res.status(400).json({ message: 'Missing or invalid quantity. Must be a positive number.' });
  }
  
  if (!walletId) {
    log('warn', 'Missing walletId for buy trade');
    return res.status(400).json({ message: 'Missing required field: walletId' });
  }
  
  // Parse values to ensure correct types
  const parsedQuantity = parseFloat(quantity);
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    log('info', `Starting buy trade transaction for user ID: ${userId}, stock ID: ${stockId}`);
    
    // Get stock details
    const stockResult = await client.query(stockQueries.GET_STOCK_BY_ID, [stockId]);
    if (stockResult.rows.length === 0) {
      throw new Error('Stock not found');
    }
    const stock = stockResult.rows[0];
    
    // Calculate total cost
    const totalCost = parseFloat(stock.last_price) * parsedQuantity;
    log('debug', `Trade details: ${parsedQuantity} shares of ${stock.symbol} at ${stock.last_price} = ${totalCost} ${stock.currency_code}`);
    
    // Check wallet balance
    const walletResult = await client.query('SELECT * FROM wallets WHERE wallet_id = $1 AND user_id = $2', [walletId, userId]);
    if (walletResult.rows.length === 0) {
      throw new Error('Wallet not found');
    }
    
    const wallet = walletResult.rows[0];
    if (wallet.currency_code !== stock.currency_code) {
      throw new Error(`Currency mismatch: Wallet is in ${wallet.currency_code}, stock is in ${stock.currency_code}`);
    }
    
    if (parseFloat(wallet.balance) < totalCost) {
      throw new Error('Insufficient funds in wallet');
    }
    
    // Update wallet balance
    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE wallet_id = $2',
      [totalCost, walletId]
    );
    
    // Record the trade
    const tradeResult = await client.query(
      tradeQueries.CREATE_TRADE,
      [userId, walletId, stockId, 'buy', parsedQuantity, stock.last_price, totalCost]
    );
    
    await client.query('COMMIT');
    log('info', `Buy trade executed successfully: Trade ID: ${tradeResult.rows[0].trade_id}`);
    
    res.status(201).json({
      message: 'Trade executed successfully',
      trade: tradeResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error executing buy trade: ${error.message}`);
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Execute a sell trade
const executeSellTrade = async (req, res) => {
  const userId = req.user.user_id;
  const { stockId, quantity, walletId } = req.body;
  
  console.log("Sell trade request body:", req.body);
  
  // Validate required fields
  if (!stockId) {
    log('warn', 'Missing stockId for sell trade');
    return res.status(400).json({ message: 'Missing required field: stockId' });
  }
  
  if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
    log('warn', 'Missing or invalid quantity for sell trade');
    return res.status(400).json({ message: 'Missing or invalid quantity. Must be a positive number.' });
  }
  
  if (!walletId) {
    log('warn', 'Missing walletId for sell trade');
    return res.status(400).json({ message: 'Missing required field: walletId' });
  }
  
  // Parse values to ensure correct types
  const parsedQuantity = parseFloat(quantity);
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    log('info', `Starting sell trade transaction for user ID: ${userId}, stock ID: ${stockId}`);
    
    // Check if user owns enough shares
    const portfolioQuery = `
      SELECT 
        SUM(CASE WHEN trade_type = 'buy' THEN quantity ELSE -quantity END) AS shares_owned
      FROM trades
      WHERE user_id = $1 AND stock_id = $2
      GROUP BY stock_id
    `;
    
    const portfolioResult = await client.query(portfolioQuery, [userId, stockId]);
    const sharesOwned = portfolioResult.rows.length > 0 ? parseFloat(portfolioResult.rows[0].shares_owned) : 0;
    
    if (sharesOwned < parsedQuantity) {
      throw new Error(`Not enough shares owned. You have ${sharesOwned} shares.`);
    }
    
    // Get stock details
    const stockResult = await client.query(stockQueries.GET_STOCK_BY_ID, [stockId]);
    if (stockResult.rows.length === 0) {
      throw new Error('Stock not found');
    }
    const stock = stockResult.rows[0];
    
    // Calculate total value
    const totalValue = parseFloat(stock.last_price) * parsedQuantity;
    log('debug', `Sell trade details: ${parsedQuantity} shares of ${stock.symbol} at ${stock.last_price} = ${totalValue} ${stock.currency_code}`);
    
    // Check wallet currency
    const walletResult = await client.query('SELECT * FROM wallets WHERE wallet_id = $1 AND user_id = $2', [walletId, userId]);
    if (walletResult.rows.length === 0) {
      throw new Error('Wallet not found');
    }
    
    const wallet = walletResult.rows[0];
    if (wallet.currency_code !== stock.currency_code) {
      throw new Error(`Currency mismatch: Wallet is in ${wallet.currency_code}, stock is in ${stock.currency_code}`);
    }
    
    // Update wallet balance
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE wallet_id = $2',
      [totalValue, walletId]
    );
    
    // Record the trade
    const tradeResult = await client.query(
      tradeQueries.CREATE_TRADE,
      [userId, walletId, stockId, 'sell', parsedQuantity, stock.last_price, totalValue]
    );
    
    await client.query('COMMIT');
    log('info', `Sell trade executed successfully: Trade ID: ${tradeResult.rows[0].trade_id}`);
    
    res.status(201).json({
      message: 'Trade executed successfully',
      trade: tradeResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error executing sell trade: ${error.message}`);
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getUserTrades,
  getTradesByType,
  getUserInvestmentValue,
  executeBuyTrade,
  executeSellTrade
}; 