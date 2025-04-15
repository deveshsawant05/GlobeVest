// Get price history for a stock
const getStockHistory = async (req, res) => {
  try {
    const { stockId } = req.params;
    const { range = '1d' } = req.query;
    
    // Define time intervals based on range parameter
    const rangeConfig = {
      '5m': { interval: '5 minutes', limit: 60 },
      '1h': { interval: '1 hour', limit: 60 },
      '1d': { interval: '1 day', limit: 24 },
      '1M': { interval: '30 days', limit: 30 }
    };
    
    // Default to 1 day if invalid range provided
    const config = rangeConfig[range] || rangeConfig['1d'];
    
    // Calculate the start time based on the range
    let startDate;
    if (range === '5m') {
      startDate = new Date(Date.now() - 5 * 60 * 1000);
    } else if (range === '1h') {
      startDate = new Date(Date.now() - 60 * 60 * 1000);
    } else if (range === '1d') {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else {
      // Default to 30 days
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Convert to ISO string for database query
    const startTime = startDate.toISOString();
    
    // Get price history from database with time filter
    const query = `
      SELECT timestamp, price
      FROM stock_prices
      WHERE stock_id = ?
      AND timestamp >= ?
      ORDER BY timestamp ASC
      LIMIT ?
    `;
    
    const [priceHistory] = await pool.query(query, [stockId, startTime, config.limit]);
    
    if (priceHistory.length === 0) {
      logger.info(`No price history found for stock ${stockId}`);
      
      // Generate some mock data if no data exists
      const [stockResult] = await pool.query(
        'SELECT last_price FROM stocks WHERE stock_id = ?',
        [stockId]
      );
      
      if (stockResult.length === 0) {
        return res.status(404).json({ message: 'Stock not found' });
      }
      
      const basePrice = stockResult[0].last_price;
      const mockData = generateMockPriceData(basePrice, config.limit, range);
      
      return res.json(mockData);
    }
    
    res.json(priceHistory);
  } catch (error) {
    logger.error('Error fetching stock price history:', error);
    res.status(500).json({ message: 'Error fetching stock price history' });
  }
};

// Helper to generate mock price data
const generateMockPriceData = (basePrice, numPoints, timeRange) => {
  const now = new Date();
  const data = [];
  
  let interval;
  if (timeRange === '5m') {
    interval = 5 * 60 * 1000; // 5 minutes in ms
  } else if (timeRange === '1h') {
    interval = 60 * 60 * 1000 / numPoints; // distribute over 1 hour
  } else if (timeRange === '1d') {
    interval = 24 * 60 * 60 * 1000 / numPoints; // distribute over 1 day
  } else {
    interval = 30 * 24 * 60 * 60 * 1000 / numPoints; // distribute over 30 days
  }
  
  // Generate data points
  for (let i = numPoints - 1; i >= 0; i--) {
    const pointTime = new Date(now.getTime() - (i * interval));
    
    // Generate a price with a slight trend and volatility
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