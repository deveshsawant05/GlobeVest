const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Initialize environment variables
dotenv.config();

// Setup PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING || 'postgres://postgres:postgres@localhost:5432/globevest'
});

// Stock data will be loaded from database
let stocks = [];

// Temporary storage for stock updates between batch inserts
let tempStockUpdates = new Map();

// Temporary storage for price history
let tempPriceHistory = new Map();

// Load stocks from database
const loadStocksFromDatabase = async () => {
  try {
    const result = await pool.query('SELECT * FROM stocks');
    
    if (result.rows.length > 0) {
      console.log(`Loading ${result.rows.length} stocks from database`);
      
      // Convert database format to application format
      stocks = result.rows.map(stock => ({
        stock_id: stock.stock_id,
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        currency_code: stock.currency_code,
        last_price: parseFloat(stock.last_price),
        change_percentage: parseFloat(stock.change_percent || 0),
        change_amount: parseFloat(stock.change_value || 0),
        volume: parseInt(stock.volume || 0),
        previous_close: parseFloat(stock.previous_close || stock.last_price),
        market_cap: parseFloat(stock.market_cap || 0),
        day_high: parseFloat(stock.day_high || stock.last_price),
        day_low: parseFloat(stock.day_low || stock.last_price),
        created_at: stock.created_at || new Date(),
        updated_at: stock.updated_at || new Date()
      }));
      
      console.log('Stocks loaded successfully from database');
    } else {
      console.log('No stocks found in database');
    }
  } catch (error) {
    console.error('Error loading stocks from database:', error.message);
  }
};

// Initialize by loading from database
loadStocksFromDatabase();

// Schedule regular reload of stocks from database (every 5 minutes)
setInterval(loadStocksFromDatabase, 5 * 60 * 1000);

// Get all stocks
const getStocks = () => {
  return stocks;
};

// Get stock by ID
const getStockById = (stockId) => {
  return stocks.find(stock => stock.stock_id === stockId);
};

// Get stocks by market
const getStocksByMarket = (market) => {
  return stocks.filter(stock => stock.market === market);
};

// Update stock prices with random movement - now stores in temporary storage
const updateStockPrices = () => {
  const updatedStocks = [];

  stocks.forEach(stock => {
    // Random price movement between -2% and +2%
    const priceChange = stock.last_price * (Math.random() * 0.04 - 0.02);
    
    // Ensure price doesn't go below 0.01
    const newPrice = Math.max(stock.last_price + priceChange, 0.01);
    const roundedPrice = parseFloat(newPrice.toFixed(2));
    
    // Calculate change from previous price
    const changeAmount = roundedPrice - stock.previous_close;
    const changePercentage = (changeAmount / stock.previous_close) * 100;
    
    // Update day high/low
    const dayHigh = Math.max(stock.day_high, roundedPrice);
    const dayLow = Math.min(stock.day_low, roundedPrice);
    
    // Update volume with random activity
    const volumeChange = Math.floor(Math.random() * 100000);
    const newVolume = stock.volume + volumeChange;
    
    // Update the stock
    stock.last_price = roundedPrice;
    stock.change_amount = parseFloat(changeAmount.toFixed(2));
    stock.change_percentage = parseFloat(changePercentage.toFixed(2));
    stock.day_high = dayHigh;
    stock.day_low = dayLow;
    stock.volume = newVolume;
    stock.updated_at = new Date();
    
    // Store in temporary map - only keep the latest update for each stock
    tempStockUpdates.set(stock.stock_id, {...stock});
    
    // Store price in temporary history map
    if (!tempPriceHistory.has(stock.stock_id)) {
      tempPriceHistory.set(stock.stock_id, []);
    }
    tempPriceHistory.get(stock.stock_id).push({
      price: roundedPrice,
      timestamp: new Date()
    });
    
    // Add to list of updated stocks to return
    updatedStocks.push(stock);
  });
  
  return updatedStocks;
};

// Save all temporary data to database in a batch
const savePendingUpdates = async () => {
  if (tempStockUpdates.size === 0 && tempPriceHistory.size === 0) {
    return; // Don't log anything if there are no updates
  }
  
  // Calculate total data points to be inserted
  let totalPriceDataPoints = 0;
  if (tempPriceHistory.size > 0) {
    for (const pricePoints of tempPriceHistory.values()) {
      totalPriceDataPoints += pricePoints.length;
    }
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Process stock updates in a batch
    if (tempStockUpdates.size > 0) {
      // Build a single query for all stock updates
      const stockValues = [];
      const stockParams = [];
      let paramIndex = 1;
      
      for (const stock of tempStockUpdates.values()) {
        stockValues.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, NOW())`);
        stockParams.push(
          stock.stock_id, 
          stock.symbol, 
          stock.name, 
          stock.market, 
          stock.currency_code, 
          stock.last_price,
          stock.change_percentage,
          stock.change_amount,
          stock.volume,
          stock.previous_close,
          stock.market_cap,
          stock.day_high,
          stock.day_low
        );
        paramIndex += 13;
      }
      
      // Execute batch update
      await client.query(`
        INSERT INTO stocks (
          stock_id, symbol, name, market, currency_code, last_price, 
          change_percent, change_value, volume, previous_close, 
          market_cap, day_high, day_low, updated_at
        )
        VALUES ${stockValues.join(', ')}
        ON CONFLICT (stock_id) 
        DO UPDATE SET 
          last_price = EXCLUDED.last_price,
          change_percent = EXCLUDED.change_percent,
          change_value = EXCLUDED.change_value,
          volume = EXCLUDED.volume,
          previous_close = EXCLUDED.previous_close,
          market_cap = EXCLUDED.market_cap,
          day_high = GREATEST(stocks.day_high, EXCLUDED.day_high),
          day_low = LEAST(stocks.day_low, EXCLUDED.day_low),
          updated_at = NOW()
      `, stockParams);
      
      // Clear temp stock updates after saving
      tempStockUpdates.clear();
    }
    
    // Process price history in a batch
    if (tempPriceHistory.size > 0) {
      // Build a single query for all price history
      const historyValues = [];
      const historyParams = [];
      let paramIndex = 1;
      
      for (const [stockId, pricePoints] of tempPriceHistory.entries()) {
        for (const point of pricePoints) {
          historyValues.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2})`);
          historyParams.push(
            stockId,
            point.price,
            point.timestamp
          );
          paramIndex += 3;
        }
      }
      
      // Execute batch insert of price history
      await client.query(`
        INSERT INTO stock_price_history (stock_id, price, timestamp)
        VALUES ${historyValues.join(', ')}
      `, historyParams);
      
      // Clear temp price history after saving
      tempPriceHistory.clear();
    }
    
    await client.query('COMMIT');
    
    // One consolidated log message showing all the data that was saved
    console.log(`Database batch update: ${tempStockUpdates.size > 0 ? `${tempStockUpdates.size} stocks updated, ` : ''}${totalPriceDataPoints > 0 ? `${totalPriceDataPoints} price history points inserted` : ''}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving batch to database:', error.message);
  } finally {
    client.release();
  }
};

// Get historical price data for a stock
const getStockPriceHistory = async (stockId, days = null) => {
  try {
    // Build query based on whether days parameter is provided
    let query;
    let params;
    
    if (days) {
      // If days is provided, filter by date range
      query = `
        SELECT price, timestamp
        FROM stock_price_history
        WHERE stock_id = $1
        AND timestamp > NOW() - INTERVAL '${days} days'
        ORDER BY timestamp ASC
      `;
      params = [stockId];
    } else {
      // If days is not provided, return all history
      query = `
        SELECT price, timestamp
        FROM stock_price_history
        WHERE stock_id = $1
        ORDER BY timestamp ASC
      `;
      params = [stockId];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      console.log(`No price history found for stock ${stockId}`);
    } else {
      console.log(`Retrieved ${result.rows.length} price history records for stock ${stockId}`);
    }
    
    return result.rows;
  } catch (error) {
    console.error(`Error fetching price history for stock ${stockId}:`, error.message);
    throw new Error(`Failed to retrieve price history: ${error.message}`);
  }
};

module.exports = {
  getStocks,
  getStockById,
  getStocksByMarket,
  updateStockPrices,
  savePendingUpdates,
  getStockPriceHistory
}; 