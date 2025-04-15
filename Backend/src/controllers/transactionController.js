const pool = require('../config/db');
const transactionQueries = require('../queries/transactionQueries');

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

// Get all transactions for a user with pagination
const getUserTransactions = async (req, res) => {
  const userId = req.user.user_id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  try {
    log('info', `Fetching transactions for user ID: ${userId}, page: ${page}, limit: ${limit}`);
    
    const transactions = await pool.query(
      transactionQueries.GET_USER_TRANSACTIONS, 
      [userId, limit, offset]
    );
    
    const countResult = await pool.query(
      transactionQueries.GET_TRANSACTION_COUNT, 
      [userId]
    );
    
    const totalTransactions = parseInt(countResult.rows[0].total);
    
    log('debug', `Retrieved ${transactions.rows.length} transactions for user`);
    
    res.status(200).json({
      transactions: transactions.rows,
      pagination: {
        total: totalTransactions,
        page,
        limit,
        pages: Math.ceil(totalTransactions / limit)
      }
    });
  } catch (error) {
    log('error', `Error retrieving user transactions: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving transactions' });
  }
};

// Get transactions by type (deposit, withdrawal, conversion)
const getTransactionsByType = async (req, res) => {
  const userId = req.user.user_id;
  const { type } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  // Validate transaction type
  const validTypes = ['deposit', 'withdrawal', 'conversion'];
  if (!validTypes.includes(type)) {
    log('warn', `Invalid transaction type: ${type}`);
    return res.status(400).json({ 
      message: 'Invalid transaction type. Valid types are: deposit, withdrawal, conversion' 
    });
  }
  
  try {
    log('info', `Fetching transactions of type ${type} for user ID: ${userId}`);
    
    const transactions = await pool.query(
      transactionQueries.GET_TRANSACTIONS_BY_TYPE, 
      [userId, type, limit, offset]
    );
    
    // Count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions
      WHERE user_id = $1 AND transaction_type = $2
    `;
    
    const countResult = await pool.query(countQuery, [userId, type]);
    const totalTransactions = parseInt(countResult.rows[0].total);
    
    log('debug', `Retrieved ${transactions.rows.length} ${type} transactions for user`);
    
    res.status(200).json({
      transactions: transactions.rows,
      pagination: {
        total: totalTransactions,
        page,
        limit,
        pages: Math.ceil(totalTransactions / limit)
      }
    });
  } catch (error) {
    log('error', `Error retrieving ${type} transactions: ${error.message}`);
    res.status(500).json({ message: `Server error retrieving ${type} transactions` });
  }
};

// Get transaction statistics for user dashboard
const getTransactionStats = async (req, res) => {
  const userId = req.user.user_id;
  
  try {
    log('info', `Calculating transaction statistics for user ID: ${userId}`);
    
    // Get most recent transactions
    const recentQuery = `
      SELECT t.transaction_id, t.transaction_type, t.amount, t.created_at, w.currency_code
      FROM transactions t
      JOIN wallets w ON t.wallet_id = w.wallet_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 5
    `;
    
    // Calculate deposit total
    const depositQuery = `
      SELECT SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 AND transaction_type = 'deposit'
    `;
    
    // Calculate withdrawal total
    const withdrawalQuery = `
      SELECT SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 AND transaction_type = 'withdrawal'
    `;
    
    // Calculate total transactions per month (last 6 months)
    const monthlyQuery = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as deposits,
        SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END) as withdrawals,
        SUM(CASE WHEN transaction_type = 'conversion' THEN amount ELSE 0 END) as conversions
      FROM transactions
      WHERE 
        user_id = $1 AND 
        created_at > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;
    
    // Execute all queries in parallel
    const [recentResult, depositResult, withdrawalResult, monthlyResult] = await Promise.all([
      pool.query(recentQuery, [userId]),
      pool.query(depositQuery, [userId]),
      pool.query(withdrawalQuery, [userId]),
      pool.query(monthlyQuery, [userId])
    ]);
    
    const stats = {
      recentTransactions: recentResult.rows,
      totalDeposits: parseFloat(depositResult.rows[0]?.total || 0),
      totalWithdrawals: parseFloat(withdrawalResult.rows[0]?.total || 0),
      monthlyActivity: monthlyResult.rows.map(row => ({
        month: row.month,
        transactionCount: parseInt(row.transaction_count),
        deposits: parseFloat(row.deposits),
        withdrawals: parseFloat(row.withdrawals),
        conversions: parseFloat(row.conversions)
      }))
    };
    
    log('debug', 'Transaction statistics calculated successfully');
    res.status(200).json(stats);
  } catch (error) {
    log('error', `Error calculating transaction statistics: ${error.message}`);
    res.status(500).json({ message: 'Server error calculating transaction statistics' });
  }
};

module.exports = {
  getUserTransactions,
  getTransactionsByType,
  getTransactionStats
}; 