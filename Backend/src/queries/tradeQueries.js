const tradeQueries = {
  // Get all trades for a user
  GET_USER_TRADES: `
    SELECT 
      t.trade_id, t.trade_type, t.quantity, t.price, t.total_amount, t.created_at,
      s.symbol, s.name, s.market, s.currency_code
    FROM trades t
    JOIN stocks s ON t.stock_id = s.stock_id
    WHERE t.user_id = $1
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `,

  // Get trade count for pagination
  GET_TRADE_COUNT: `
    SELECT COUNT(*) as total
    FROM trades
    WHERE user_id = $1
  `,

  // Record a new trade
  CREATE_TRADE: `
    INSERT INTO trades (user_id, wallet_id, stock_id, trade_type, quantity, price, total_amount)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,
  
  // Get trades by type (buy/sell)
  GET_TRADES_BY_TYPE: `
    SELECT 
      t.trade_id, t.trade_type, t.quantity, t.price, t.total_amount, t.created_at,
      s.symbol, s.name, s.market, s.currency_code
    FROM trades t
    JOIN stocks s ON t.stock_id = s.stock_id
    WHERE t.user_id = $1 AND t.trade_type = $2
    ORDER BY t.created_at DESC
    LIMIT $3 OFFSET $4
  `,

  // Get a user's total investment value
  GET_USER_INVESTMENT_VALUE: `
    WITH user_holdings AS (
      SELECT 
        stock_id,
        SUM(CASE WHEN trade_type = 'buy' THEN quantity ELSE -quantity END) AS total_quantity
      FROM trades
      WHERE user_id = $1
      GROUP BY stock_id
      HAVING SUM(CASE WHEN trade_type = 'buy' THEN quantity ELSE -quantity END) > 0
    )
    SELECT 
      SUM(uh.total_quantity * s.last_price) AS total_value
    FROM user_holdings uh
    JOIN stocks s ON uh.stock_id = s.stock_id
  `
};

module.exports = tradeQueries; 