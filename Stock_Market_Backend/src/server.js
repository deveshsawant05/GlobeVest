const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const stockData = require('./stockData');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Initialize environment variables
dotenv.config();

// Setup PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING || 'postgres://postgres:postgres@localhost:5432/globevest'
});

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Default stock data for initialization
const defaultStocks = [
  // US Market (NASDAQ)
  { 
    symbol: 'AAPL', 
    name: 'Apple Inc.', 
    market: 'NASDAQ', 
    currency_code: 'USD', 
    last_price: 175.34,
    previous_close: 174.43,
    market_cap: 2750000000000,
    volume: 38294567
  },
  // More stocks as defined in initializeStocks.js...
  // Note: This is a shortened list for brevity
];

// Function to check if stocks table exists and has data
async function checkStocksExist() {
  try {
    // Check if there are any stocks in the database
    const result = await pool.query('SELECT COUNT(*) FROM stocks');
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking stocks table:', error.message);
    return false;
  }
}

// Function to initialize stocks
async function initializeStocks() {
  try {
    // Check if stocks already exist
    const stocksExist = await checkStocksExist();
    
    if (stocksExist) {
      console.log('Stocks table already contains data. Skipping initialization.');
      return;
    }
    
    console.log('No stocks found. Initializing stocks table with default data...');
    
    // Insert a few default stocks (shortened list for brevity)
    for (const stock of defaultStocks) {
      // Calculate derived values
      const changeAmount = stock.last_price - stock.previous_close;
      const changePercentage = (changeAmount / stock.previous_close) * 100;
      
      await pool.query(`
        INSERT INTO stocks (
          stock_id, symbol, name, market, currency_code, 
          last_price, previous_close, market_cap, volume,
          change_percent, change_value, day_high, day_low,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        ON CONFLICT (symbol) DO NOTHING
      `, [
        uuidv4(),
        stock.symbol,
        stock.name,
        stock.market,
        stock.currency_code,
        stock.last_price,
        stock.previous_close,
        stock.market_cap,
        stock.volume,
        parseFloat(changePercentage.toFixed(2)),
        parseFloat(changeAmount.toFixed(2)),
        stock.last_price, // Initial day_high is the current price
        stock.last_price  // Initial day_low is the current price
      ]);
    }
    
    console.log(`Successfully initialized stocks table with sample data.`);
  } catch (error) {
    console.error('Error initializing stocks:', error.message);
  }
}

// Initialize stocks before starting the server
async function startServer() {
  // Initialize stocks if needed
  await initializeStocks();
  
  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000'
  }));
  app.use(express.json());
  
  // Routes
  app.get('/', (req, res) => {
    res.json({ message: 'Stock Market API is running' });
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok',
      message: 'Stock Market Server is running',
      timestamp: new Date().toISOString()
    });
  });
  
  // Get all stocks
  app.get('/api/stocks', (req, res) => {
    res.json(stockData.getStocks());
  });
  
  // Get stock by ID
  app.get('/api/stocks/:stockId', (req, res) => {
    const stock = stockData.getStockById(req.params.stockId);
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }
    res.json(stock);
  });
  
  // Get stocks by market
  app.get('/api/markets/:market', (req, res) => {
    const stocks = stockData.getStocksByMarket(req.params.market);
    res.json(stocks);
  });
  
  // Get historical prices for a stock
  app.get('/api/stocks/:stockId/history', async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days) : null;
      console.log(`Fetching history for stock ${req.params.stockId}${days ? `, last ${days} days` : ', all history'}`);
      
      const history = await stockData.getStockPriceHistory(req.params.stockId, days);
      res.json(history);
    } catch (error) {
      console.error('Error fetching stock history:', error);
      res.status(500).json({ 
        message: 'Error fetching stock history',
        error: error.message 
      });
    }
  });
  
  // WebSocket connections for real-time updates
  io.on('connection', (socket) => {
    console.log('Client connected');
  
    // Send initial stock data
    socket.emit('stocksInitial', stockData.getStocks());
  
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  
    // Subscribe to specific stock updates
    socket.on('subscribeToStock', (stockId) => {
      console.log(`Client subscribed to stock: ${stockId}`);
      socket.join(`stock-${stockId}`);
    });
  
    // Unsubscribe from specific stock updates
    socket.on('unsubscribeFromStock', (stockId) => {
      console.log(`Client unsubscribed from stock: ${stockId}`);
      socket.leave(`stock-${stockId}`);
    });
  });
  
  // Start price updates at intervals
  const PRICE_UPDATE_INTERVAL = 5000; // 5 seconds
  const DB_UPDATE_INTERVAL = 60000; // 1 minute
  
  setInterval(() => {
    const updatedStocks = stockData.updateStockPrices();
    
    // Emit to all clients
    io.emit('stocksUpdate', updatedStocks);
    
    // Emit individual stock updates to subscribed clients
    updatedStocks.forEach(stock => {
      io.to(`stock-${stock.stock_id}`).emit('stockUpdate', stock);
    });
  }, PRICE_UPDATE_INTERVAL);
  
  // Save updates to database every minute
  setInterval(() => {
    stockData.savePendingUpdates();
  }, DB_UPDATE_INTERVAL);
  
  // Start server
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`Stock Market Server running on port ${PORT}`);
  });
}

// Run the server
startServer(); 