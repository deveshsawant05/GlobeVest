const transactionQueries = {
  // Get all transactions for a user
  GET_USER_TRANSACTIONS: `
    SELECT 
      t.transaction_id, t.transaction_type, t.amount, t.created_at,
      w.currency_code
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.wallet_id
    WHERE t.user_id = $1
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `,

  // Get transaction count for pagination
  GET_TRANSACTION_COUNT: `
    SELECT COUNT(*) as total
    FROM transactions
    WHERE user_id = $1
  `,

  // Record a new transaction
  CREATE_TRANSACTION: `
    INSERT INTO transactions (user_id, wallet_id, transaction_type, amount)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
  
  // Get transactions by type
  GET_TRANSACTIONS_BY_TYPE: `
    SELECT 
      t.transaction_id, t.transaction_type, t.amount, t.created_at,
      w.currency_code
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.wallet_id
    WHERE t.user_id = $1 AND t.transaction_type = $2
    ORDER BY t.created_at DESC
    LIMIT $3 OFFSET $4
  `
};

module.exports = transactionQueries; 