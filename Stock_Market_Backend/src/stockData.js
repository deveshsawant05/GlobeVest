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

// Pending updates for batch processing
let pendingUpdates = [];

// Temporary storage for price history
let priceHistoryBuffer = new Map();

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

// Update stock prices with random movement
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
    
    // Add to pending updates for batch processing
    pendingUpdates.push({...stock});
    
    // Add to price history buffer
    if (!priceHistoryBuffer.has(stock.stock_id)) {
      priceHistoryBuffer.set(stock.stock_id, []);
    }
    priceHistoryBuffer.get(stock.stock_id).push(roundedPrice);
    
    // Add to list of updated stocks to return
    updatedStocks.push(stock);
  });
  
  return updatedStocks;
};

// Save pending stock updates to database
const savePendingUpdates = async () => {
  if (pendingUpdates.length === 0 && priceHistoryBuffer.size === 0) {
    return;
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Process stock updates
    if (pendingUpdates.length > 0) {
      const updatesCount = pendingUpdates.length;
      console.log(`Saving batch of ${updatesCount} stock updates to database`);
      
      // Process each stock once (use Set to deduplicate)
      const stocksToUpdate = Array.from(
        new Map(pendingUpdates.map(stock => [stock.stock_id, stock])).values()
      );
      
      for (const stock of stocksToUpdate) {
        await client.query(`
          INSERT INTO stocks (
            stock_id, symbol, name, market, currency_code, last_price, 
            change_percent, change_value, volume, previous_close, 
            market_cap, day_high, day_low, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (stock_id) 
          DO UPDATE SET 
            last_price = $6,
            change_percent = $7,
            change_value = $8,
            volume = $9,
            previous_close = $10,
            market_cap = $11,
            day_high = $12,
            day_low = $13,
            updated_at = NOW()
        `, [
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
        ]);
      }
    }
    
    // Process price history updates
    if (priceHistoryBuffer.size > 0) {
      console.log(`Saving ${priceHistoryBuffer.size} stocks' price history to database`);
      
      for (const [stockId, prices] of priceHistoryBuffer.entries()) {
        // Save each individual price point instead of just the average
        for (let i = 0; i < prices.length; i++) {
          const price = prices[i];
          // Calculate a timestamp slightly offset for each entry in the batch
          // This ensures we maintain the correct order and don't have duplicate timestamps
          const offsetSeconds = i * (60 / prices.length);
          
          await client.query(`
            INSERT INTO stock_price_history (stock_id, price, timestamp)
            VALUES ($1, $2, NOW() - INTERVAL '${offsetSeconds} seconds')
          `, [stockId, price]);
        }
        
        console.log(`Saved ${prices.length} data points for stock ${stockId}`);
      }
      
      // Clear the buffer after saving
      priceHistoryBuffer.clear();
    }
    
    await client.query('COMMIT');
    console.log('Successfully saved updates to database');
    
    // Clear pending updates after successful save
    pendingUpdates = [];
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