const pool = require('../config/db');
const stockQueries = require('../queries/stockQueries');
const axios = require('axios');
const logger = require('../utils/logger');

// Stock Market Backend URL
const STOCK_API_URL = process.env.STOCK_API_URL || 'http://localhost:5001/api';

// Get all stocks
const getAllStocks = async (req, res) => {
  try {
    logger.info('Fetching all stocks from Stock Market API');
    const response = await axios.get(`${STOCK_API_URL}/stocks`);
    logger.debug(`Retrieved ${response.data.length} stocks`);
    res.status(200).json(response.data);
  } catch (error) {
    logger.error(`Error retrieving stocks: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving stocks' });
  }
};

// Get stock by ID
const getStockById = async (req, res) => {
  const { stockId } = req.params;
  
  try {
    logger.info(`Fetching stock with ID: ${stockId}`);
    const response = await axios.get(`${STOCK_API_URL}/stocks/${stockId}`);
    
    if (!response.data) {
      logger.warn(`Stock with ID ${stockId} not found`);
      return res.status(404).json({ message: 'Stock not found' });
    }
    
    logger.debug(`Retrieved stock: ${response.data.symbol}`);
    res.status(200).json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.warn(`Stock with ID ${stockId} not found`);
      return res.status(404).json({ message: 'Stock not found' });
    }
    logger.error(`Error retrieving stock: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving stock' });
  }
};

// Get stocks by market
const getStocksByMarket = async (req, res) => {
  const { market } = req.params;
  
  try {
    logger.info(`Fetching stocks from market: ${market}`);
    const response = await axios.get(`${STOCK_API_URL}/markets/${market}`);
    logger.debug(`Retrieved ${response.data.length} stocks from ${market}`);
    res.status(200).json(response.data);
  } catch (error) {
    logger.error(`Error retrieving stocks by market: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving stocks' });
  }
};

// Get user portfolio
const getUserPortfolio = async (req, res) => {
  const userId = req.user.user_id;
  
  try {
    logger.info(`Fetching portfolio for user ID: ${userId}`);
    const result = await pool.query(stockQueries.GET_USER_PORTFOLIO, [userId]);
    
    // For each stock in the portfolio, fetch current price from Stock Market API
    if (result.rows.length > 0) {
      for (let i = 0; i < result.rows.length; i++) {
        try {
          const stock = result.rows[i];
          const response = await axios.get(`${STOCK_API_URL}/stocks/${stock.stock_id}`);
          
          if (response.data) {
            // Update with latest price
            stock.last_price = response.data.last_price;
            // Recalculate total value with updated price
            stock.total_value = stock.total_quantity * response.data.last_price;
          }
        } catch (error) {
          logger.warn(`Could not fetch latest price for stock ${result.rows[i].symbol}: ${error.message}`);
          // Continue with the next stock, using the DB price for this one
        }
      }
    }
    
    logger.debug(`Retrieved ${result.rows.length} stocks in user portfolio`);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error retrieving user portfolio: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving portfolio' });
  }
};

// Update stock prices (for mock data or scheduled updates)
const updateStockPrices = async (req, res) => {
  // For demo purposes, this can simulate real market changes
  try {
    logger.info('Starting stock price update process');
    
    // Get all stocks
    const stocksResult = await pool.query(stockQueries.GET_ALL_STOCKS);
    const stocks = stocksResult.rows;
    logger.debug(`Retrieved ${stocks.length} stocks for price update`);
    
    // Update each stock with a small random price movement
    // In a real app, you would call an external API for real stock data
    const updates = [];
    for (const stock of stocks) {
      // Random price movement between -3% and +3%
      const priceChange = stock.last_price * (Math.random() * 0.06 - 0.03);
      const newPrice = Math.max(stock.last_price + priceChange, 0.01);
      const roundedPrice = parseFloat(newPrice.toFixed(4));
      
      updates.push(
        pool.query(stockQueries.UPDATE_STOCK_PRICE, [roundedPrice, stock.stock_id])
      );
    }
    
    await Promise.all(updates);
    logger.info('Stock price update completed successfully');
    
    res.status(200).json({ message: 'Stock prices updated successfully' });
  } catch (error) {
    logger.error(`Error updating stock prices: ${error.message}`);
    res.status(500).json({ message: 'Server error updating stock prices' });
  }
};

// Seed initial stock data (for testing or initialization)
const seedStockData = async (req, res) => {
  try {
    logger.info('Starting stock data seeding process');
    
    // Sample stock data for different markets
    const sampleStocks = [
      // US Market (NASDAQ)
      { symbol: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ', currency_code: 'USD', price: 175.34 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'NASDAQ', currency_code: 'USD', price: 328.79 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'NASDAQ', currency_code: 'USD', price: 132.45 },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'NASDAQ', currency_code: 'USD', price: 142.56 },
      { symbol: 'META', name: 'Meta Platforms Inc.', market: 'NASDAQ', currency_code: 'USD', price: 326.89 },
      
      // Japan (Nikkei)
      { symbol: '7203.T', name: 'Toyota Motor Corp.', market: 'Nikkei', currency_code: 'JPY', price: 2345.00 },
      { symbol: '9984.T', name: 'SoftBank Group Corp.', market: 'Nikkei', currency_code: 'JPY', price: 6789.00 },
      { symbol: '6758.T', name: 'Sony Group Corp.', market: 'Nikkei', currency_code: 'JPY', price: 12567.00 },
      
      // UK (FTSE)
      { symbol: 'HSBA.L', name: 'HSBC Holdings plc', market: 'FTSE', currency_code: 'GBP', price: 624.50 },
      { symbol: 'BP.L', name: 'BP plc', market: 'FTSE', currency_code: 'GBP', price: 485.25 },
      { symbol: 'GSK.L', name: 'GSK plc', market: 'FTSE', currency_code: 'GBP', price: 1423.75 },
      
      // Germany (DAX)
      { symbol: 'BMW.DE', name: 'Bayerische Motoren Werke AG', market: 'DAX', currency_code: 'EUR', price: 96.45 },
      { symbol: 'SAP.DE', name: 'SAP SE', market: 'DAX', currency_code: 'EUR', price: 128.90 },
      { symbol: 'SIE.DE', name: 'Siemens AG', market: 'DAX', currency_code: 'EUR', price: 154.20 },
      
      // India (NIFTY)
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', market: 'NIFTY', currency_code: 'INR', price: 2512.35 },
      { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd.', market: 'NIFTY', currency_code: 'INR', price: 3456.90 },
      { symbol: 'INFY.NS', name: 'Infosys Ltd.', market: 'NIFTY', currency_code: 'INR', price: 1345.60 }
    ];
    
    for (const stock of sampleStocks) {
      await pool.query(
        stockQueries.CREATE_STOCK,
        [stock.symbol, stock.name, stock.market, stock.currency_code, stock.price]
      );
    }
    
    logger.info(`Successfully seeded ${sampleStocks.length} stocks`);
    res.status(200).json({ message: 'Stock data seeded successfully' });
  } catch (error) {
    logger.error(`Error seeding stock data: ${error.message}`);
    res.status(500).json({ message: 'Server error seeding stock data' });
  }
};

// Get stock price history
const getStockHistory = async (req, res) => {
  try {
    const { stockId } = req.params;
    const { range = '1d' } = req.query;
    
    logger.info(`Fetching price history for stock ${stockId} with range ${range}`);
    
    // Try to get it from the Stock Market API
    try {
      const response = await axios.get(`${STOCK_API_URL}/stocks/${stockId}/history?range=${range}`);
      logger.debug(`Retrieved ${response.data.length} price history points from API`);
      return res.status(200).json(response.data);
    } catch (apiError) {
      logger.warn(`Could not fetch price history from API: ${apiError.message}`);
      
      // If API call fails, generate mock data
      // Get current stock price first
      try {
        const stockResponse = await axios.get(`${STOCK_API_URL}/stocks/${stockId}`);
        if (!stockResponse.data) {
          logger.warn(`Stock not found with ID ${stockId}`);
          return res.status(404).json({ message: 'Stock not found' });
        }
        
        const mockData = generateMockPriceHistory(stockResponse.data.last_price, range);
        logger.info(`Generated mock price history with ${mockData.length} data points`);
        return res.status(200).json(mockData);
      } catch (stockError) {
        logger.error(`Error fetching stock for mock data: ${stockError.message}`);
        return res.status(500).json({ message: 'Error generating price history' });
      }
    }
  } catch (error) {
    logger.error(`Error in getStockHistory: ${error.message}`);
    res.status(500).json({ message: 'Server error retrieving price history' });
  }
};

// Helper to generate mock price history
const generateMockPriceHistory = (basePrice, timeRange) => {
  const now = new Date();
  const data = [];
  
  // Configure based on requested time range
  let numPoints, interval;
  switch (timeRange) {
    case '5m':
      numPoints = 60;
      interval = 5 * 1000; // 5 seconds
      break;
    case '1h':
      numPoints = 60;
      interval = 60 * 1000; // 1 minute
      break;
    case '1d':
      numPoints = 24;
      interval = 60 * 60 * 1000; // 1 hour
      break;
    case '1M':
    default:
      numPoints = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
  }
  
  // Generate data points
  for (let i = numPoints - 1; i >= 0; i--) {
    const pointTime = new Date(now.getTime() - (i * interval));
    
    // Generate price with a slight trend and volatility
    const trend = (numPoints - i) / numPoints * 0.1; // Slight upward trend
    const volatility = (Math.random() - 0.5) * 0.05; // Random noise
    
    // Add more volatility for shorter timeframes
    const extraVolatility = timeRange === '5m' || timeRange === '1h' ? 
      Math.sin(i * (Math.PI / 6)) * 0.02 : 0;
    
    const price = basePrice * (1 + trend + volatility + extraVolatility);
    
    data.push({
      timestamp: pointTime.toISOString(),
      price: parseFloat(price.toFixed(2))
    });
  }
  
  return data;
};

module.exports = {
  getAllStocks,
  getStockById,
  getStocksByMarket,
  getUserPortfolio,
  updateStockPrices,
  seedStockData,
  getStockHistory
}; 