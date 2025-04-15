const { v4: uuidv4 } = require('uuid');

// Initial stock data
let stocks = [
  // US Market (NASDAQ)
  { 
    stock_id: uuidv4(), 
    symbol: 'AAPL', 
    name: 'Apple Inc.', 
    market: 'NASDAQ', 
    currency_code: 'USD', 
    last_price: 175.34,
    change_percentage: 0.52,
    change_amount: 0.91,
    volume: 38294567,
    previous_close: 174.43,
    market_cap: 2750000000000,
    day_high: 176.82,
    day_low: 174.21,
    created_at: new Date(),
    updated_at: new Date()
  },
  { 
    stock_id: uuidv4(), 
    symbol: 'MSFT', 
    name: 'Microsoft Corporation', 
    market: 'NASDAQ', 
    currency_code: 'USD', 
    last_price: 328.79,
    change_percentage: 0.87,
    change_amount: 2.83,
    volume: 24567432,
    previous_close: 325.96,
    market_cap: 2450000000000,
    day_high: 329.93,
    day_low: 325.55,
    created_at: new Date(),
    updated_at: new Date()
  },
  { 
    stock_id: uuidv4(), 
    symbol: 'GOOGL', 
    name: 'Alphabet Inc.', 
    market: 'NASDAQ', 
    currency_code: 'USD', 
    last_price: 132.45,
    change_percentage: -0.34,
    change_amount: -0.45,
    volume: 19876543,
    previous_close: 132.90,
    market_cap: 1680000000000,
    day_high: 133.25,
    day_low: 131.98,
    created_at: new Date(),
    updated_at: new Date()
  },
  
  // Japan (Nikkei)
  { 
    stock_id: uuidv4(), 
    symbol: '7203.T', 
    name: 'Toyota Motor Corp.', 
    market: 'Nikkei', 
    currency_code: 'JPY', 
    last_price: 2345.00,
    change_percentage: 1.23,
    change_amount: 28.50,
    volume: 5643298,
    previous_close: 2316.50,
    market_cap: 32500000000000,
    day_high: 2352.00,
    day_low: 2315.00,
    created_at: new Date(),
    updated_at: new Date()
  },
  { 
    stock_id: uuidv4(), 
    symbol: '9984.T', 
    name: 'SoftBank Group Corp.', 
    market: 'Nikkei', 
    currency_code: 'JPY', 
    last_price: 6789.00,
    change_percentage: -0.76,
    change_amount: -52.00,
    volume: 3421569,
    previous_close: 6841.00,
    market_cap: 10900000000000,
    day_high: 6850.00,
    day_low: 6720.00,
    created_at: new Date(),
    updated_at: new Date()
  },
  
  // UK (FTSE)
  { 
    stock_id: uuidv4(), 
    symbol: 'HSBA.L', 
    name: 'HSBC Holdings plc', 
    market: 'FTSE', 
    currency_code: 'GBP', 
    last_price: 624.50,
    change_percentage: 0.43,
    change_amount: 2.70,
    volume: 14563298,
    previous_close: 621.80,
    market_cap: 123000000000,
    day_high: 627.30,
    day_low: 621.40,
    created_at: new Date(),
    updated_at: new Date()
  },
  { 
    stock_id: uuidv4(), 
    symbol: 'BP.L', 
    name: 'BP plc', 
    market: 'FTSE', 
    currency_code: 'GBP', 
    last_price: 485.25,
    change_percentage: -0.34,
    change_amount: -1.65,
    volume: 18976542,
    previous_close: 486.90,
    market_cap: 87500000000,
    day_high: 488.60,
    day_low: 483.20,
    created_at: new Date(),
    updated_at: new Date()
  },
  
  // Germany (DAX)
  { 
    stock_id: uuidv4(), 
    symbol: 'BMW.DE', 
    name: 'Bayerische Motoren Werke AG', 
    market: 'DAX', 
    currency_code: 'EUR', 
    last_price: 96.45,
    change_percentage: 1.02,
    change_amount: 0.97,
    volume: 6589423,
    previous_close: 95.48,
    market_cap: 62400000000,
    day_high: 96.89,
    day_low: 95.32,
    created_at: new Date(),
    updated_at: new Date()
  },
  { 
    stock_id: uuidv4(), 
    symbol: 'SAP.DE', 
    name: 'SAP SE', 
    market: 'DAX', 
    currency_code: 'EUR', 
    last_price: 128.90,
    change_percentage: 0.67,
    change_amount: 0.86,
    volume: 8754321,
    previous_close: 128.04,
    market_cap: 158000000000,
    day_high: 129.45,
    day_low: 127.98,
    created_at: new Date(),
    updated_at: new Date()
  },
  
  // India (NIFTY)
  { 
    stock_id: uuidv4(), 
    symbol: 'RELIANCE.NS', 
    name: 'Reliance Industries Ltd.', 
    market: 'NIFTY', 
    currency_code: 'INR', 
    last_price: 2512.35,
    change_percentage: 1.45,
    change_amount: 35.90,
    volume: 12345678,
    previous_close: 2476.45,
    market_cap: 17000000000000,
    day_high: 2525.60,
    day_low: 2475.20,
    created_at: new Date(),
    updated_at: new Date()
  },
  { 
    stock_id: uuidv4(), 
    symbol: 'TCS.NS', 
    name: 'Tata Consultancy Services Ltd.', 
    market: 'NIFTY', 
    currency_code: 'INR', 
    last_price: 3456.90,
    change_percentage: -0.23,
    change_amount: -8.10,
    volume: 8765432,
    previous_close: 3465.00,
    market_cap: 12400000000000,
    day_high: 3472.50,
    day_low: 3445.60,
    created_at: new Date(),
    updated_at: new Date()
  }
];

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
    
    updatedStocks.push(stock);
  });
  
  return updatedStocks;
};

// Export methods
module.exports = {
  getStocks,
  getStockById,
  getStocksByMarket,
  updateStockPrices
}; 