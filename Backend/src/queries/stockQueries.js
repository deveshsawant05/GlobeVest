const stockQueries = {
  // Get all available stocks
  GET_ALL_STOCKS: `
    SELECT * FROM stocks
    ORDER BY market, symbol
  `,

  // Get stock by ID
  GET_STOCK_BY_ID: `
    SELECT * FROM stocks
    WHERE stock_id = $1
  `,

  // Get stocks by market
  GET_STOCKS_BY_MARKET: `
    SELECT * FROM stocks
    WHERE market = $1
    ORDER BY symbol
  `,

  // Update stock price
  UPDATE_STOCK_PRICE: `
    UPDATE stocks
    SET last_price = $1, updated_at = NOW()
    WHERE stock_id = $2
    RETURNING *
  `,

  // Create a new stock entry
  CREATE_STOCK: `
    INSERT INTO stocks (symbol, name, market, currency_code, last_price)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,

  // Get user portfolio (stocks owned)
  GET_USER_PORTFOLIO: `
    WITH user_trades AS (
      SELECT 
        stock_id,
        SUM(CASE WHEN trade_type = 'buy' THEN quantity ELSE -quantity END) AS total_quantity
      FROM trades
      WHERE user_id = $1
      GROUP BY stock_id
      HAVING SUM(CASE WHEN trade_type = 'buy' THEN quantity ELSE -quantity END) > 0
    )
    SELECT 
      s.stock_id, s.symbol, s.name, s.market, s.currency_code, s.last_price,
      ut.total_quantity,
      (ut.total_quantity * s.last_price) AS total_value
    FROM user_trades ut
    JOIN stocks s ON ut.stock_id = s.stock_id
    ORDER BY s.market, s.symbol
  `
};

module.exports = stockQueries; 