import { io } from 'socket.io-client';

// Stock market socket connection
let socket = null;
let isConnected = false;
let subscribers = new Map();
let stockData = new Map();

const STOCK_MARKET_WEBSOCKET_URL = process.env.NEXT_PUBLIC_STOCK_MARKET_URL || 'http://localhost:5001';

// Initialize connection
export const initStockSocket = () => {
  if (socket) {
    return;
  }
  
  socket = io(STOCK_MARKET_WEBSOCKET_URL);
  
  socket.on('connect', () => {
    console.log('Connected to stock market socket server');
    isConnected = true;
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from stock market socket server');
    isConnected = false;
  });
  
  socket.on('stocksInitial', (stocks) => {
    console.log('Received initial stock data');
    
    // Store in local cache
    stocks.forEach(stock => {
      stockData.set(stock.stock_id, stock);
    });
    
    // Notify subscribers of initial data
    subscribers.forEach((callbacks, stockId) => {
      const stock = stockData.get(stockId);
      if (stock) {
        callbacks.forEach(callback => callback(stock));
      }
    });
  });
  
  socket.on('stocksUpdate', (stocks) => {
    // Update local cache
    stocks.forEach(stock => {
      stockData.set(stock.stock_id, stock);
    });
    
    // Notify subscribers
    stocks.forEach(stock => {
      const callbacks = subscribers.get(stock.stock_id);
      if (callbacks) {
        callbacks.forEach(callback => callback(stock));
      }
    });
  });
  
  socket.on('stockUpdate', (stock) => {
    // Update local cache
    stockData.set(stock.stock_id, stock);
    
    // Notify subscribers
    const callbacks = subscribers.get(stock.stock_id);
    if (callbacks) {
      callbacks.forEach(callback => callback(stock));
    }
  });
};

// Subscribe to stock updates
export const subscribeToStock = (stockId, callback) => {
  if (!stockId) return;
  
  // Initialize connection if needed
  if (!socket) {
    initStockSocket();
  }
  
  // Add to subscribers
  if (!subscribers.has(stockId)) {
    subscribers.set(stockId, new Set());
    
    // Tell server we're interested in this stock
    if (isConnected) {
      socket.emit('subscribeToStock', stockId);
    }
  }
  
  subscribers.get(stockId).add(callback);
  
  // If we already have data for this stock, send it immediately
  const stock = stockData.get(stockId);
  if (stock) {
    callback(stock);
  }
  
  // Return unsubscribe function
  return () => {
    unsubscribeFromStock(stockId, callback);
  };
};

// Unsubscribe from stock updates
export const unsubscribeFromStock = (stockId, callback) => {
  if (!subscribers.has(stockId)) return;
  
  const callbacks = subscribers.get(stockId);
  callbacks.delete(callback);
  
  // If no more subscribers for this stock, unsubscribe from server
  if (callbacks.size === 0) {
    subscribers.delete(stockId);
    
    if (socket && isConnected) {
      socket.emit('unsubscribeFromStock', stockId);
    }
  }
};

// Get current stock data from cache
export const getCachedStockData = (stockId) => {
  return stockData.get(stockId);
};

// Close the connection
export const closeStockSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
    subscribers.clear();
  }
}; 