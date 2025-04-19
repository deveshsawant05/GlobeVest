"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { StocksAPI, WalletAPI } from "@/lib/api";
import { useSocket } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";

// Import our new components
import StockChart from "@/components/trade/stock-chart";
import TradeForm from "@/components/trade/trade-form";
import StockInfo from "@/components/trade/stock-info";

export default function TradePage() {
  const { stockId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const socket = useSocket(process.env.NEXT_PUBLIC_STOCK_MARKET_URL);
  
  // Time range options
  const timeRangeOptions = {
    "5m": { label: "5 Min", timeMs: 5 * 60 * 1000, interval: 1 },
    "1h": { label: "1 Hour", timeMs: 60 * 60 * 1000, interval: 5 },
    "1d": { label: "1 Day", timeMs: 24 * 60 * 60 * 1000, interval: 30 },
    "1mo": { label: "1 Month", timeMs: 30 * 24 * 60 * 60 * 1000, interval: 60 * 12 }
  };
  
  // State variables
  const [stock, setStock] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState([]);
  const [timeRange, setTimeRange] = useState("5m"); // Default to 5m
  const priceHistoryRef = useRef([]);
  const allPriceHistoryRef = useRef([]);
  
  // Create stable references for chart data with fixed size
  const chartDataRef = useRef({
    "5m": Array(60).fill(null), // 60 points for 5 minutes (one per 5 seconds)
    "1h": Array(120).fill(null), // 60 points for 1 hour (one per minute)
    "1d": Array(96).fill(null), // 96 points for 1 day (one per 15 minutes)
    "1M": Array(30).fill(null)  // 30 points for 1 month (one per day)
  });
  
  // Use a ref to track the last update time to prevent too frequent UI updates
  const lastUpdateTimeRef = useRef(Date.now());
  
  // Use a ref to track when we should force an update
  const shouldUpdateRef = useRef(false);
  
  // Track the last received data point timestamp
  const lastDataPointRef = useRef(new Date());
  
  // State for forcing chart re-renders (only when necessary)
  const [chartUpdateTrigger, setChartUpdateTrigger] = useState(0);
  
  // Initial data loading
  useEffect(() => {
    if (!stockId) return;
    fetchData();
  }, [stockId]);
  
  // Helper function to get time range in milliseconds
  const getRangeTimeMs = (range) => {
    switch(range) {
      case "5m": return 5 * 60 * 1000;
      case "1h": return 60 * 60 * 1000;
      case "1d": return 24 * 60 * 60 * 1000;
      case "1M": return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  };

  // Filter data based on the selected time range
  const getDataForTimeRange = (data, range) => {
    if (!data || data.length === 0) return [];
    
    const now = new Date();
    let cutoffTime = new Date(now.getTime() - getRangeTimeMs(range));
    
    // Filter data to only include points after cutoff time
    let filteredData = data.filter(point => point.fullDate >= cutoffTime);
    
    // If we don't have enough points, don't filter
    if (filteredData.length < 5) {
      filteredData = [...data]; // Use all available data
    }
    
    // Re-index the filtered data to ensure sequential IDs
    return filteredData.map((point, index) => ({
      ...point,
      id: index
    }));
  };
  
  // Function to populate chart data for different time ranges
  const populateChartData = (data) => {
    if (!data || data.length === 0) {
      console.warn("No data provided to populateChartData");
      return;
    }
    
    console.log(`Populating chart data with ${data.length} points`);
    
    // Initialize data storage for each time range if not already done
    if (!chartDataRef.current) {
      chartDataRef.current = {
        "5m": [],
        "1h": [],
        "1d": [],
        "1M": []
      };
    }
    
    // Clone and sort the data to ensure chronological order
    const sortedData = [...data].sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    
    // Ensure each point has an id
    sortedData.forEach((point, index) => {
      point.id = point.id || index;
    });
    
    // Calculate appropriate intervals for each time range
    const now = new Date();
    const timeRanges = ["5m", "1h", "1d", "1M"];
    
    // Process each time range
    timeRanges.forEach(range => {
      const rangeMs = getRangeTimeMs(range);
      const startTime = new Date(now.getTime() - rangeMs);
      
      // Determine appropriate interval for this range
      let interval;
      let pointCount;
      
      switch(range) {
        case "5m":
          interval = 5 * 1000; // 5 seconds
          pointCount = 60;
          break;
        case "1h":
          interval = 30 * 1000; // 1/2 minute
          pointCount = 60;
          break;
        case "1d":
          interval = 15 * 60 * 1000; // 15 minutes
          pointCount = 96;
          break;
        case "1M":
          interval = 24 * 60 * 60 * 1000; // 1 day
          pointCount = 30;
          break;
      }
      
      // Create array of appropriate size
      const rangeData = new Array(pointCount).fill(null);
      chartDataRef.current[range] = rangeData;
      
      // Filter data points for this time range
      const relevantPoints = sortedData.filter(point => 
        point.fullDate >= startTime && point.fullDate <= now
      );
      
      // If we have no data points in range, try to use the most recent data before the range
      if (relevantPoints.length === 0) {
        // Find the most recent data point before this range
        const lastPointBeforeRange = sortedData
          .filter(point => point.fullDate < startTime)
          .sort((a, b) => b.fullDate.getTime() - a.fullDate.getTime())[0];
        
        if (lastPointBeforeRange) {
          console.log(`Using last available point for ${range} chart`);
          // Use this point for the entire range
          for (let i = 0; i < rangeData.length; i++) {
            const pointTime = new Date(startTime.getTime() + (i * interval));
            rangeData[i] = {
              ...lastPointBeforeRange,
              id: i,
              fullDate: pointTime
            };
          }
        }
      } else {
        console.log(`Found ${relevantPoints.length} data points for ${range} range`);
        
        // Fill in the rangeData array with the appropriate points
        for (let i = 0; i < rangeData.length; i++) {
          const pointTime = new Date(startTime.getTime() + (i * interval));
          
          // Find the closest data point before or equal to this time
          const closestPoint = relevantPoints
            .filter(point => point.fullDate <= pointTime)
            .sort((a, b) => b.fullDate.getTime() - a.fullDate.getTime())[0];
          
          // Find the next data point after this time (for possible interpolation)
          const nextPoint = relevantPoints
            .filter(point => point.fullDate > pointTime)
            .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())[0];
          
          if (closestPoint) {
            // Use the closest point for this interval
            rangeData[i] = {
              ...closestPoint,
              id: i, // Use sequential index for proper left-to-right display
              fullDate: pointTime
            };
          } else if (nextPoint && i > 0 && rangeData[i-1]) {
            // If no previous point but we have the next point and a previous interval,
            // interpolate between previous interval and next point
            const prevPoint = rangeData[i-1];
            const prevTime = prevPoint.fullDate.getTime();
            const nextTime = nextPoint.fullDate.getTime();
            const currentTime = pointTime.getTime();
            
            // Calculate position between previous and next (0 to 1)
            const ratio = (currentTime - prevTime) / (nextTime - prevTime);
            // Interpolate price
            const price = prevPoint.price + ratio * (nextPoint.price - prevPoint.price);
            
            rangeData[i] = {
              ...prevPoint,
              price: parseFloat(price.toFixed(2)),
              id: i,
              fullDate: pointTime
            };
          } else if (i > 0 && rangeData[i-1]) {
            // If no points available, just copy the previous interval
            rangeData[i] = {
              ...rangeData[i-1],
              id: i,
              fullDate: pointTime
            };
          }
        }
      }
    });
    
    // Store all data
    allPriceHistoryRef.current = sortedData;
    
    // Set initial filtered data to the selected time range (default 5m)
    priceHistoryRef.current = chartDataRef.current[timeRange] && Array.isArray(chartDataRef.current[timeRange]) 
      ? [...chartDataRef.current[timeRange]].filter(Boolean) 
      : [];
    setPriceHistory(priceHistoryRef.current);
  };

  // Generate fallback data if needed
  const generateInitialData = (currentPrice) => {
    console.warn("Using fallback data generation - this should only be used if the WebSocket server is not available");
    
    // Create an empty array to hold the data
    const data = [];
    
    // Current time
    const now = new Date();
    
    // Create a data point with current price
    const createDataPoint = (timestamp, price) => {
      // Add some randomness to the price (±1%)
      const randomFactor = 0.98 + Math.random() * 0.04; // between 0.98 and 1.02
      const adjustedPrice = price * randomFactor;
      
      return {
        id: data.length,
        price: parseFloat(adjustedPrice.toFixed(2)),
        open: parseFloat(adjustedPrice.toFixed(2)),
        high: parseFloat((adjustedPrice * 1.005).toFixed(2)),
        low: parseFloat((adjustedPrice * 0.995).toFixed(2)),
        close: parseFloat(adjustedPrice.toFixed(2)),
        volume: Math.floor(Math.random() * 10000) + 1000,
        fullDate: new Date(timestamp),
        date: new Date(timestamp).toLocaleDateString(),
        time: new Date(timestamp).toLocaleTimeString()
      };
    };
    
    // Generate data points at regular intervals for the last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const totalPoints = 100; // Generate 100 points
    const interval = (now.getTime() - thirtyDaysAgo.getTime()) / totalPoints;
    
    for (let i = 0; i < totalPoints; i++) {
      const timestamp = new Date(thirtyDaysAgo.getTime() + i * interval);
      data.push(createDataPoint(timestamp, currentPrice));
    }
    
    // Sort by time
    data.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    
    // Fill the chart data with the generated data
    populateChartData(data);
    
    // Trigger a chart update
    setChartUpdateTrigger(prev => prev + 1);
  };
  
  // Main data fetching function
  const fetchData = async () => {
    try {
      setInitialLoading(true);
      
      // Fetch stock details
      const stockResponse = await StocksAPI.getStockById(stockId);
      setStock(stockResponse.data);
      
      // Fetch wallet data
      const walletsResponse = await WalletAPI.getUserWallets();
      const filteredWallets = walletsResponse.data.filter(
        wallet => wallet.currency_code === stockResponse.data.currency_code
      );
      setWallets(filteredWallets);
      
      // Fetch initial price history from API (only once)
      try {
        // Use a larger timeframe (1M) to have data for all time ranges
        console.log("Fetching 1M historical data for stock:", stockId);
        const response = await StocksAPI.getStockHistory(stockId, "1M");
      
        if (response.data && response.data.length > 0) {
          console.log("Received historical price data points:", response.data.length);
        
          // Format the data for the chart
          const formattedData = response.data.map((point, index) => {
            // Convert UTC timestamp to local time
            const utcTimestamp = new Date(point.timestamp);
            
            return {
              id: index,
              date: utcTimestamp.toLocaleDateString(),
              time: utcTimestamp.toLocaleTimeString(),
              fullDate: utcTimestamp, // Store the date object
              price: parseFloat(point.price),
              open: parseFloat(point.open || point.price),
              high: parseFloat(point.high || point.price * 1.005),
              low: parseFloat(point.low || point.price * 0.995),
              close: parseFloat(point.close || point.price),
              volume: point.volume || Math.floor(Math.random() * 10000) + 1000
            };
          });
          
          // Sort chronologically from oldest to newest
          formattedData.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
          
          // Fill chart data for each time range
          populateChartData(formattedData);
          
          // Set the initial time range to 5m
          setTimeRange("5m");
          
          // Update the price history reference with the 5m data
          const currentRangeData = chartDataRef.current["5m"];
          priceHistoryRef.current = currentRangeData && Array.isArray(currentRangeData) 
            ? [...currentRangeData].filter(Boolean) 
            : [];
          setPriceHistory(priceHistoryRef.current);
          
          // Trigger initial render
          setChartUpdateTrigger(prev => prev + 1);
        } else {
          // Fallback to generated data if API returns empty
          console.warn("No historical data received from API, falling back to generated data");
          generateInitialData(stockResponse.data.last_price);
          
          // Ensure 5m is set as the default time range
          setTimeRange("5m");
        }
      } catch (error) {
        console.error("Error fetching historical data:", error);
        generateInitialData(stockResponse.data.last_price);
        
        // Ensure 5m is set as the default time range
        setTimeRange("5m");
      }
      
      setInitialLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setInitialLoading(false);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load stock data",
      });
    }
  };
  
  // Effect for websocket connection and data handling
  useEffect(() => {
    if (!stock || !socket) return;
    
    console.log(`Setting up real-time stock updates for ${stock.name} (${stock.stock_id})`);
    
    // Subscribe to specific stock updates
    socket.emit('subscribeToStock', stock.stock_id);
    
    // Listen for both individual and batch updates
    const handleStockUpdate = (updatedStock) => {
      if (updatedStock.stock_id !== stock.stock_id) return;
      
      console.log("Received stock update:", updatedStock.symbol, updatedStock.last_price);
      
      // Update the stock data without triggering a chart re-render
      setStock(current => ({
        ...current,
        ...updatedStock
      }));
      
      // Current timestamp
      const timestamp = new Date();
      
      // Create new data point
      const newDataPoint = {
        price: parseFloat(updatedStock.last_price),
        open: parseFloat(updatedStock.last_price),
        high: parseFloat(updatedStock.day_high || updatedStock.last_price),
        low: parseFloat(updatedStock.day_low || updatedStock.last_price),
        close: parseFloat(updatedStock.last_price),
        volume: parseInt(updatedStock.volume || 0),
        fullDate: timestamp,
        date: timestamp.toLocaleDateString(),
        time: timestamp.toLocaleTimeString()
      };
      
      // Add to all historical data
      allPriceHistoryRef.current = [
        ...allPriceHistoryRef.current,
        newDataPoint
      ].sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
      
      // Fill in data points between last update and current update
      const lastTimestamp = lastDataPointRef.current;
      const timeDiff = timestamp.getTime() - lastTimestamp.getTime();
      
      // Update each time range's data
      Object.keys(chartDataRef.current).forEach(range => {
        const rangeData = chartDataRef.current[range];
        
        // Determine the interval for this range
        let interval;
        switch(range) {
          case "5m": interval = 5 * 1000; break;  // 5 seconds
          case "1h": interval = 60 * 1000; break; // 1 minute
          case "1d": interval = 15 * 60 * 1000; break; // 15 minutes
          case "1M": interval = 24 * 60 * 60 * 1000; break; // 1 day
        }
        
        // Find the right position for the new data point
        const now = new Date();
        const rangeStartTime = new Date(now.getTime() - getRangeTimeMs(range));
        
        // Only update if the new point is within this range's time window
        if (timestamp >= rangeStartTime) {
          // Calculate which interval this point belongs to
          const timeSinceStart = timestamp.getTime() - rangeStartTime.getTime();
          const intervalIndex = Math.floor(timeSinceStart / interval);
          
          // Only update if within array bounds
          if (intervalIndex >= 0 && intervalIndex < rangeData.length) {
            // Store the new data point in the correct interval
            rangeData[intervalIndex] = {
              ...newDataPoint,
              id: intervalIndex
            };
            
            // Fill in any missing data points between last update and current
            // This only applies if there was a previous update
            if (lastTimestamp && timeDiff > interval) {
              // Find the last interval index
              const lastIntervalIndex = Math.floor(
                (lastTimestamp.getTime() - rangeStartTime.getTime()) / interval
              );
              
              // Get the previous price point (from last update)
              const previousPoint = allPriceHistoryRef.current
                .filter(p => p.fullDate <= lastTimestamp)
                .sort((a, b) => b.fullDate.getTime() - a.fullDate.getTime())[0];
                
              if (previousPoint && lastIntervalIndex >= 0 && intervalIndex > lastIntervalIndex + 1) {
                // We need to fill in points between lastIntervalIndex and intervalIndex
                const previousPrice = previousPoint.price;
                const priceChange = newDataPoint.price - previousPrice;
                
                // Fill in gaps between last and current interval with interpolated values
                for (let i = lastIntervalIndex + 1; i < intervalIndex; i++) {
                  // Calculate the ratio for linear interpolation
                  const ratio = (i - lastIntervalIndex) / (intervalIndex - lastIntervalIndex);
                  const interpolatedPrice = previousPrice + ratio * priceChange;
                  const pointTime = new Date(rangeStartTime.getTime() + (i * interval));
                  
                  // Only fill in if there's no data already at this index
                  if (!rangeData[i] || rangeData[i] === null) {
                    rangeData[i] = {
                      ...previousPoint,
                      price: parseFloat(interpolatedPrice.toFixed(2)),
                      fullDate: pointTime,
                      date: pointTime.toLocaleDateString(),
                      time: pointTime.toLocaleTimeString(),
                      id: i
                    };
                  }
                }
              }
            }
          }
        }
      });
      
      // Update the last timestamp reference
      lastDataPointRef.current = timestamp;
      
      // Only update the chart every second at most to prevent glitches
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 1000) {
        lastUpdateTimeRef.current = now;
        
        // Update the price history from the fixed array
        const currentRangeData = chartDataRef.current[timeRange];
        // Add null check before spreading
        priceHistoryRef.current = currentRangeData && Array.isArray(currentRangeData) ? [...currentRangeData].filter(Boolean) : [];
        
        // Use the precise reference for the current time range
        setPriceHistory(priceHistoryRef.current);
        
        // Also trigger a chart update
        setChartUpdateTrigger(prev => prev + 1);
      } else {
        // Mark that we need an update soon
        shouldUpdateRef.current = true;
      }
    };
    
    socket.on('stockUpdate', handleStockUpdate);
    socket.on('stocksUpdate', (stocks) => {
      const updatedStock = stocks.find(s => s.stock_id === stock.stock_id);
      if (updatedStock) handleStockUpdate(updatedStock);
    });
    
    // Set up an interval to check for pending updates
    const updateInterval = setInterval(() => {
      if (shouldUpdateRef.current) {
        shouldUpdateRef.current = false;
        lastUpdateTimeRef.current = Date.now();
        
        // Get the current data for selected time range
        const currentRangeData = chartDataRef.current[timeRange];
        // Add null check before spreading
        priceHistoryRef.current = currentRangeData && Array.isArray(currentRangeData) ? [...currentRangeData].filter(Boolean) : [];
        
        // Update the chart with current time range data
        setPriceHistory(priceHistoryRef.current);
        setChartUpdateTrigger(prev => prev + 1);
      }
    }, 1000); // Check every second
    
    // Logging for debugging
    console.log("Socket connection status:", socket.connected);
    socket.on('connect', () => {
      console.log("Socket connected successfully");
      // Re-subscribe after reconnection
      socket.emit('subscribeToStock', stock.stock_id);
    });
    
    socket.on('disconnect', () => {
      console.log("Socket disconnected");
    });
    
    // Cleanup on unmount
    return () => {
      console.log(`Unsubscribing from ${stock.name} updates`);
      socket.emit('unsubscribeFromStock', stock.stock_id);
      socket.off('stockUpdate');
      socket.off('stocksUpdate');
      socket.off('connect');
      socket.off('disconnect');
      clearInterval(updateInterval);
    };
  }, [stock, socket, timeRange]);
  
  // Handle time range changes
  const handleTimeRangeChange = (newRange) => {
    console.log(`Changing time range from ${timeRange} to ${newRange}`);
    
    // Set new time range
    setTimeRange(newRange);
    
    // Get data for the new time range from our fixed arrays
    const rangeData = chartDataRef.current[newRange];
    // Add null check before spreading
    const filteredData = rangeData && Array.isArray(rangeData) ? [...rangeData].filter(Boolean) : [];
    
    // Update the price history with the new filtered data
    priceHistoryRef.current = filteredData;
    setPriceHistory(filteredData);
    
    // Force chart update
    setChartUpdateTrigger(prev => prev + 1);
  };
  
  // Handle wallet refresh after trade execution
  const handleTradeComplete = async () => {
    try {
      // Refresh wallet data
      const walletsResponse = await WalletAPI.getUserWallets();
      const filteredWallets = walletsResponse.data.filter(
        wallet => wallet.currency_code === stock.currency_code
      );
      setWallets(filteredWallets);
    } catch (error) {
      console.error("Error refreshing wallets:", error);
    }
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading stock data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!stock) {
    return (
      <DashboardLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <p>Stock not found</p>
            <Button 
              className="mt-4"
              onClick={() => router.push("/markets")}
            >
              Return to Markets
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{stock.name}</h1>
            <p className="text-lg font-medium text-muted-foreground">{stock.symbol}</p>
          </div>
          <p className="text-muted-foreground">
            {stock.market} • {stock.currency_code}
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <StockChart 
              stock={stock}
              priceHistory={priceHistory}
              timeRange={timeRange}
              timeRangeOptions={timeRangeOptions}
              handleTimeRangeChange={handleTimeRangeChange}
              isLoading={initialLoading}
              chartUpdateTrigger={chartUpdateTrigger}
            />
          </div>
          
          <div>
            <TradeForm 
              stock={stock}
              wallets={wallets}
              onTradeComplete={handleTradeComplete}
            />
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <StockInfo stock={stock} />
        </div>
      </div>
    </DashboardLayout>
  );
}