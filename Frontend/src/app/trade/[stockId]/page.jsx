"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, ArrowDown, ArrowUp } from "lucide-react";
import { StocksAPI, WalletAPI, TradesAPI } from "@/lib/api";
import { useSocket } from "@/hooks/use-socket";
import { convertUTCToLocal, formatTimestamp } from "@/lib/utils";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, BarChart, Bar, ReferenceLine,
  ComposedChart, Scatter
} from "recharts";

// Timestamp formatting options based on time range
const timeRangeOptions = {
  "5m": {
    tooltipFormat: "HH:mm:ss", // Show hours, minutes, seconds
    axisFormat: "HH:mm:ss",
    dataPoints: 60, // 60 data points for 5 minutes (1 per 5 seconds)
    interval: 5 * 1000, // 5 seconds
    timeMs: 5 * 60 * 1000
  },
  "1h": {
    tooltipFormat: "HH:mm",
    axisFormat: "HH:mm",
    dataPoints: 60, // 60 data points for 1 hour (1 per minute)
    interval: 60 * 1000, // 1 minute
    timeMs: 60 * 60 * 1000
  },
  "1d": {
    tooltipFormat: "HH:mm",
    axisFormat: "HH:mm",
    dataPoints: 96, // 96 data points for 1 day (1 per 15 minutes)
    interval: 15 * 60 * 1000, // 15 minutes
    timeMs: 24 * 60 * 60 * 1000
  },
  "1M": {
    tooltipFormat: "MMM dd",
    axisFormat: "MMM dd",
    dataPoints: 30, // 30 data points for 1 month (1 per day)
    interval: 24 * 60 * 60 * 1000, // 1 day
    timeMs: 30 * 24 * 60 * 60 * 1000
  }
};

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
  const [selectedWallet, setSelectedWallet] = useState("");
  const [quantity, setQuantity] = useState("");
  const [tradeType, setTradeType] = useState("buy");
  const [initialLoading, setInitialLoading] = useState(true); // Separate loading state for initial load
  const [dataLoading, setDataLoading] = useState(false); // Loading state for data updates
  const [priceHistory, setPriceHistory] = useState([]);
  const [timeRange, setTimeRange] = useState("1d");
  const [chartStyle, setChartStyle] = useState("line"); // 'line' or 'candlestick'
  const priceHistoryRef = useRef([]);
  const allPriceHistoryRef = useRef([]); // Store all historical data from websocket and API
  
  // Create stable references for chart data with fixed size
  const chartDataRef = useRef({
    "5m": Array(60).fill(null), // 60 points for 5 minutes (one per 5 seconds)
    "1h": Array(60).fill(null), // 60 points for 1 hour (one per minute)
    "1d": Array(96).fill(null), // 96 points for 1 day (one per 15 minutes)
    "1M": Array(30).fill(null)  // 30 points for 1 month (one per day)
  });
  
  // Use a ref to track the last update time to prevent too frequent UI updates
  const lastUpdateTimeRef = useRef(Date.now());
  
  // Use a ref to track when we should force an update
  const shouldUpdateRef = useRef(false);
  
  // State for forcing chart re-renders (only when necessary)
  const [chartUpdateTrigger, setChartUpdateTrigger] = useState(0);
  
  // Get market trend for display
  const getMarketTrend = () => {
    if (!stock) {
      return { positive: true, percent: "0.00" };
    }
    
    const changePercent = stock.change_percentage;
    return {
      positive: changePercent >= 0,
      percent: Math.abs(changePercent).toFixed(2)
    };
  };
  
  // Market trend calculation
  const marketTrend = getMarketTrend();
  
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
  
  // Populate chart data for all time ranges
  const populateChartData = (data) => {
    // Sort data by time (oldest to newest)
    const sortedData = [...data].sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    
    // Get current time
    const now = new Date();
    
    // For each time range, fill the chart data arrays
    Object.keys(chartDataRef.current).forEach(range => {
      const rangeData = chartDataRef.current[range];
      
      // Determine interval and start time based on range
      let interval, startTime;
      switch(range) {
        case "5m":
          interval = 5 * 1000; // 5 seconds
          startTime = new Date(now.getTime() - 5 * 60 * 1000);
          break;
        case "1h":
          interval = 60 * 1000; // 1 minute
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "1d":
          interval = 15 * 60 * 1000; // 15 minutes
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "1M":
          interval = 24 * 60 * 60 * 1000; // 1 day
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      // Clear the array
      rangeData.fill(null);
      
      // Find data points for each interval - working backwards from now
      for (let i = 0; i < rangeData.length; i++) {
        const pointTime = new Date(startTime.getTime() + (i * interval));
        
        // Find the closest data point before this time
        const closestPoint = sortedData.find(point => 
          point.fullDate <= pointTime
        );
        
        // Find the next data point to interpolate between if needed
        const nextPoint = sortedData.find(point => 
          point.fullDate > pointTime
        );
        
        if (closestPoint) {
          // Use the closest point for this interval
          rangeData[i] = {
            ...closestPoint,
            id: i, // Use sequential index for proper left-to-right display
            fullDate: pointTime
          };
        } else if (i > 0 && rangeData[i-1]) {
          // If no point found but we have a previous valid point, use that 
          // with adjusted timestamp
          rangeData[i] = {
            ...rangeData[i-1],
            id: i,
            fullDate: pointTime
          };
        }
      }
    });
    
    // Store all data
    allPriceHistoryRef.current = sortedData;
    
    // Set initial filtered data
    priceHistoryRef.current = [...chartDataRef.current[timeRange]].filter(Boolean);
    setPriceHistory(priceHistoryRef.current);
  };
  
  // Helper function to get appropriate axis ticks
  const getAxisTicks = (dataLength) => {
    if (dataLength <= 5) return undefined; // Let Recharts decide for small datasets
    
    // Generate 5 evenly spaced ticks
    const result = [];
    const tickCount = Math.min(5, dataLength);
    const step = Math.floor(dataLength / (tickCount - 1));
    
    for (let i = 0; i < dataLength; i += step) {
      result.push(i);
      if (result.length >= tickCount - 1) break;
    }
    
    // Always include the last point
    if (dataLength > 1 && result[result.length - 1] !== dataLength - 1) {
      result.push(dataLength - 1);
    }
    
    return result;
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
      
      // Set default wallet if available
      if (filteredWallets.length > 0) {
        setSelectedWallet(filteredWallets[0].wallet_id.toString());
      }
      
      // Fetch initial price history from API
      try {
        // Use a larger timeframe (1M) to have data for all time ranges
        const response = await StocksAPI.getStockHistory(stockId, "1M");
      
      if (response.data && response.data.length > 0) {
          console.log("Received historical price data points:", response.data.length);
        
        // Format the data for the chart
        const formattedData = response.data.map((point, index) => {
          // Convert UTC timestamp to local time
          const utcTimestamp = point.timestamp;
          const localDate = new Date(utcTimestamp);
          
          return {
            id: index,
            date: localDate.toLocaleDateString(),
            time: localDate.toLocaleTimeString(),
            fullDate: localDate, // Store the local date object
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
          
          // Trigger initial render
          setChartUpdateTrigger(prev => prev + 1);
      } else {
          // Fallback to generated data if API returns empty
          console.warn("No historical data received from API, falling back to generated data");
          generateInitialData(stockResponse.data.last_price);
      }
    } catch (error) {
        console.error("Error fetching historical data:", error);
        generateInitialData(stockResponse.data.last_price);
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
      
      // Create new data point
      const timestamp = new Date();
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
          
          // Only update if within array bounds (should always be true, but just in case)
          if (intervalIndex >= 0 && intervalIndex < rangeData.length) {
            rangeData[intervalIndex] = {
              ...newDataPoint,
              id: intervalIndex
            };
          }
        }
      });
      
      // Only update the chart every second at most to prevent glitches
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 1000) {
        lastUpdateTimeRef.current = now;
        
        // Update the price history from the fixed array
        const currentRangeData = chartDataRef.current[timeRange];
        priceHistoryRef.current = [...currentRangeData].filter(Boolean);
        
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
        priceHistoryRef.current = [...currentRangeData].filter(Boolean);
        
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
  
  // Fetch historical data when component mounts
  useEffect(() => {
    if (!stock) return;
    
    const fetchHistoricalData = async () => {
      try {
        setDataLoading(true);
        const response = await StocksAPI.getStockHistory(stock.stock_id, "1M");
        
        if (response.data && response.data.length > 0) {
          console.log(`Received ${response.data.length} historical data points for ${stock.symbol}`);
          
          // Format the data for the chart
          const formattedData = response.data.map((point, index) => {
            const localDate = new Date(point.timestamp);
            
            return {
              id: index,
              date: localDate.toLocaleDateString(),
              time: localDate.toLocaleTimeString(),
              fullDate: localDate,
              price: parseFloat(point.price),
              open: parseFloat(point.open || point.price),
              high: parseFloat(point.high || point.price * 1.005),
              low: parseFloat(point.low || point.price * 0.995),
              close: parseFloat(point.close || point.price),
              volume: point.volume || Math.floor(Math.random() * 10000) + 1000
            };
          });
          
          // Sort chronologically
          formattedData.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
          
          // Store all historical data
          allPriceHistoryRef.current = formattedData;
          
          // Filter for the selected time range
          const filteredData = getDataForTimeRange(formattedData, timeRange);
          priceHistoryRef.current = filteredData;
          setPriceHistory(filteredData);
        } else {
          console.warn("No historical data received, generating mock data");
          generateInitialData(stock.last_price);
        }
      } catch (error) {
        console.error("Error fetching historical data:", error);
        generateInitialData(stock.last_price);
      } finally {
        setDataLoading(false);
      }
    };
    
    fetchHistoricalData();
  }, [stock]);
  
  // Handle time range changes
  const handleTimeRangeChange = (newRange) => {
    console.log(`Changing time range from ${timeRange} to ${newRange}`);
    
    // Set new time range
    setTimeRange(newRange);
    
    // Get data for the new time range from our fixed arrays
    const rangeData = chartDataRef.current[newRange];
    const filteredData = [...rangeData].filter(Boolean);
    
    // Update the price history with the new filtered data
    priceHistoryRef.current = filteredData;
    setPriceHistory(filteredData);
    
    // Force chart update
    setChartUpdateTrigger(prev => prev + 1);
  };
  
  // Filter price history data based on the selected time range
  const getFilteredPriceHistory = () => {
    return priceHistory;
  };
  
  // Get filtered data based on time range
  const filteredPriceHistory = useMemo(() => getFilteredPriceHistory(), [priceHistory]);
  
  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  
  // Calculate total cost/proceeds
  const calculateTotal = () => {
    if (!stock || !quantity || isNaN(parseFloat(quantity))) {
      return 0;
    }
    
    return parseFloat(quantity) * stock.last_price;
  };
  
  // Execute trade
  const executeTrade = async () => {
    if (!stock || !selectedWallet || !quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please enter a valid quantity and select a wallet",
      });
      return;
    }
    
    const total = calculateTotal();
    
    // If buying, check if wallet has enough funds
    if (tradeType === "buy") {
      const wallet = wallets.find(w => w.wallet_id.toString() === selectedWallet);
      if (!wallet || parseFloat(wallet.balance) < total) {
        toast({
          variant: "destructive",
          title: "Insufficient Funds",
          description: `You need ${formatCurrency(total, stock.currency_code)} but only have ${formatCurrency(wallet.balance, stock.currency_code)}`,
        });
        return;
      }
    }
    
    setDataLoading(true);
    
    try {
      // Find the actual wallet object for better data access
      const wallet = wallets.find(w => w.wallet_id.toString() === selectedWallet);
      
      if (!wallet) {
        throw new Error("Selected wallet not found");
      }
      
      // Prepare trade data ensuring all fields are present and properly formatted
      const tradeData = {
        stockId: stock.stock_id,
        walletId: wallet.wallet_id,
        quantity: parseFloat(quantity)
      };
      
      console.log("Executing trade with data:", JSON.stringify(tradeData));
      
      if (tradeType === "buy") {
        await TradesAPI.executeBuyTrade(tradeData);
        toast({
          title: "Buy Order Executed",
          description: `Successfully purchased ${quantity} shares of ${stock.symbol}`,
        });
      } else {
        await TradesAPI.executeSellTrade(tradeData);
        toast({
          title: "Sell Order Executed",
          description: `Successfully sold ${quantity} shares of ${stock.symbol}`,
        });
      }
      
      // Refresh wallet and stock data
      const walletsResponse = await WalletAPI.getUserWallets();
      const filteredWallets = walletsResponse.data.filter(
        wallet => wallet.currency_code === stock.currency_code
      );
      setWallets(filteredWallets);
      
      // Clear form
      setQuantity("");
      
    } catch (error) {
      console.error("Trade execution error:", error);
      console.error("Error response data:", error.response?.data);
      
      // Provide more detailed error message to user
      let errorMessage = "Failed to execute trade";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Trade Failed",
        description: errorMessage
      });
    } finally {
      setDataLoading(false);
    }
  };
  
  // Format time for chart tooltip based on selected time range
  const formatChartTime = (timestamp) => {
    const localDate = new Date(timestamp);
    
    // Use appropriate format based on time range
    const config = timeRangeOptions[timeRange];
    const options = {
      hour: "numeric",
      minute: "numeric"
    };
    
    if (timeRange === "5m" || timeRange === "1h") {
      // For small time ranges, show seconds
      options.second = "numeric";
    }
    
    if (timeRange === "1M") {
      // For monthly view, show date
      options.month = "short";
      options.day = "numeric";
      delete options.hour;
      delete options.minute;
    }
    
    if (timeRange === "1d") {
      // For daily view, keep hours and minutes
      options.hour = "numeric";
      options.minute = "numeric";
    }
    
    return localDate.toLocaleTimeString(undefined, options);
  };

  // Format date for display - using the local timezone
  const formatDate = (date) => {
    if (!date) return "";
    
    // Convert UTC to local time
    const localDate = convertUTCToLocal(date);
    
    const options = { 
      month: 'short', 
      day: 'numeric',
      year: localDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    };
    
    return localDate.toLocaleDateString(undefined, options);
  };
  
  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background rounded-lg border border-border p-3 shadow-md">
          <p className="text-sm font-medium">{formatDate(data.fullDate)}</p>
          <p className="text-sm text-muted-foreground">{formatChartTime(data.fullDate)}</p>
          {chartStyle === 'candlestick' ? (
            <div className="space-y-1 mt-2">
              <p className="text-xs">Open: <span className="font-medium">{formatCurrency(data.open, stock?.currency_code)}</span></p>
              <p className="text-xs">High: <span className="font-medium">{formatCurrency(data.high, stock?.currency_code)}</span></p>
              <p className="text-xs">Low: <span className="font-medium">{formatCurrency(data.low, stock?.currency_code)}</span></p>
              <p className="text-xs">Close: <span className="font-medium">{formatCurrency(data.close, stock?.currency_code)}</span></p>
            </div>
          ) : (
            <p className="text-sm font-bold mt-1">
              {formatCurrency(data.price, stock?.currency_code)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Volume: {data.volume?.toLocaleString() || '0'}
          </p>
        </div>
      );
    }
    return null;
  };
  
  // Get chart color based on price trend
  const getChartColor = () => {
    if (!filteredPriceHistory || filteredPriceHistory.length < 2) {
      return { stroke: "hsl(var(--primary))", fill: "hsl(var(--primary))", fillOpacity: 0.1 };
    }
    
    const firstPrice = filteredPriceHistory[0].price;
    const lastPrice = filteredPriceHistory[filteredPriceHistory.length - 1].price;
    const isPositive = lastPrice >= firstPrice;
    
    return {
      stroke: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
      fill: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
      fillOpacity: 0.1
    };
  };
  
  // Memoize the chart color calculation to prevent unnecessary re-renders
  const chartColor = useMemo(() => getChartColor(), [filteredPriceHistory]);
  
  // Memoize the Y-axis domain calculation
  const yAxisDomain = useMemo(() => {
    if (!filteredPriceHistory || filteredPriceHistory.length === 0) return ['auto', 'auto'];
    
    const allPrices = filteredPriceHistory.flatMap(entry => [
      entry.price, entry.open, entry.high, entry.low, entry.close
    ].filter(Boolean));
    
    // Ensure we have valid numbers
    const validPrices = allPrices.filter(p => !isNaN(p));
    if (validPrices.length === 0) return ['auto', 'auto'];
    
    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    
    // Add padding (a bit more on top for price display)
    const range = max - min;
    const padding = range * 0.1;
    
    return [min - padding * 0.5, max + padding];
  }, [filteredPriceHistory]);
  
  // Create a stable identifier for the chart
  const chartKey = useMemo(() => `chart-${timeRange}-${chartUpdateTrigger}`, [timeRange, chartUpdateTrigger]);

  // Render the price chart with memoization
  const renderPriceChart = useMemo(() => {
    // Skip rendering if no data or loading initial data
    if (!filteredPriceHistory.length) return null;
    
    // Calculate Y axis domain once
    const prices = filteredPriceHistory.map(p => p?.price).filter(Boolean);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    const domain = [min - padding, max + padding];
    
    // Get appropriate X-axis ticks
    const ticks = getAxisTicks(filteredPriceHistory.length);
    
    return (
      <LineChart
        key={chartKey}
        data={filteredPriceHistory}
        margin={{
          top: 10,
          right: 30,
          left: 10,
          bottom: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="id" 
          type="number"
          tickFormatter={(id) => {
            const item = filteredPriceHistory.find(p => p?.id === id);
            return item?.fullDate ? formatChartTime(item.fullDate) : '';
          }}
          domain={[0, filteredPriceHistory.length - 1]}
          ticks={ticks}
        />
        <YAxis 
          orientation="right"
          domain={domain}
          tickFormatter={(value) => formatCurrency(value, stock?.currency_code).replace(/[^\d.]/g, '')}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotoneX"
          dataKey="price"
          stroke={chartColor.stroke}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, strokeWidth: 1, stroke: "#fff" }}
          isAnimationActive={false}
          connectNulls={true}
        />
      </LineChart>
    );
  }, [filteredPriceHistory, chartKey, stock, chartColor]);
  
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Price Chart</CardTitle>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center text-sm ${marketTrend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {marketTrend.positive ? (
                      <TrendingUp className="mr-1 h-4 w-4" />
                    ) : (
                      <TrendingDown className="mr-1 h-4 w-4" />
                    )}
                    {marketTrend.positive ? '+' : '-'}{marketTrend.percent}%
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex space-x-2">
                      {Object.entries(timeRangeOptions).map(([key, value]) => (
                    <button
                          key={key}
                          onClick={() => handleTimeRangeChange(key)}
                          className={`px-3 py-1 text-xs font-medium rounded-md ${
                            timeRange === key
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {value.label}
                    </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <div className="relative h-full w-full">
                    {/* Live price display - moved to top left */}
                    <div className="absolute top-0 left-0 z-10 m-4">
                      <div className="bg-background/80 p-4 rounded-lg text-center shadow-sm backdrop-blur-sm border border-border">
                        <p className="text-3xl font-bold">{formatCurrency(stock.last_price, stock.currency_code)}</p>
                        <div className={`flex items-center justify-center mt-2 text-sm ${stock.change_percentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {stock.change_percentage >= 0 ? (
                            <TrendingUp className="mr-1 h-4 w-4" />
                          ) : (
                            <TrendingDown className="mr-1 h-4 w-4" />
                          )}
                          {stock.change_percentage >= 0 ? '+' : ''}{stock.change_percentage.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    {/* Price chart using Recharts - memoized to prevent flickering */}
                    <div className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {initialLoading ? (
                          <div className="h-full w-full flex items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                          </div>
                        ) : filteredPriceHistory.length === 0 ? (
                          <div className="h-full w-full flex flex-col items-center justify-center">
                            <p className="text-muted-foreground">No data available for the selected time range</p>
                          </div>
                        ) : renderPriceChart}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Trade {stock.symbol}</CardTitle>
                <CardDescription>
                  Current price: {formatCurrency(stock.last_price, stock.currency_code)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="buy" value={tradeType} onValueChange={setTradeType} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy" className="gap-2">
                      <ArrowDown className="h-4 w-4 text-green-500" />
                      Buy
                    </TabsTrigger>
                    <TabsTrigger value="sell" className="gap-2">
                      <ArrowUp className="h-4 w-4 text-red-500" />
                      Sell
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="buy" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="wallet">Wallet ({stock.currency_code})</Label>
                      <Select
                        value={selectedWallet}
                        onValueChange={setSelectedWallet}
                        disabled={wallets.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select wallet" />
                        </SelectTrigger>
                        <SelectContent>
                          {wallets.map((wallet) => (
                            <SelectItem key={wallet.wallet_id} value={wallet.wallet_id.toString()}>
                              {wallet.currency_code} ({formatCurrency(wallet.balance, wallet.currency_code)})
                            </SelectItem>
                          ))}
                          {wallets.length === 0 && (
                            <SelectItem value="no-wallet" disabled>
                              No {stock.currency_code} wallet available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {wallets.length === 0 && (
                        <p className="text-xs text-destructive">
                          You need a {stock.currency_code} wallet to trade this stock.
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Enter number of shares"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    
                    <div className="pt-2">
                      <div className="flex justify-between text-sm">
                        <span>Estimated Cost:</span>
                        <span className="font-bold">
                          {formatCurrency(calculateTotal(), stock.currency_code)}
                        </span>
                      </div>
                      
                      <Button
                        className="w-full mt-4"
                        onClick={executeTrade}
                        disabled={
                          dataLoading || 
                          wallets.length === 0 || 
                          !quantity || 
                          isNaN(parseFloat(quantity)) || 
                          parseFloat(quantity) <= 0
                        }
                      >
                        {dataLoading ? "Processing..." : "Buy Stock"}
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="sell" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="wallet">Wallet ({stock.currency_code})</Label>
                      <Select
                        value={selectedWallet}
                        onValueChange={setSelectedWallet}
                        disabled={wallets.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select wallet" />
                        </SelectTrigger>
                        <SelectContent>
                          {wallets.map((wallet) => (
                            <SelectItem key={wallet.wallet_id} value={wallet.wallet_id.toString()}>
                              {wallet.currency_code} ({formatCurrency(wallet.balance, wallet.currency_code)})
                            </SelectItem>
                          ))}
                          {wallets.length === 0 && (
                            <SelectItem value="no-wallet" disabled>
                              No {stock.currency_code} wallet available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Enter number of shares"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    
                    <div className="pt-2">
                      <div className="flex justify-between text-sm">
                        <span>Estimated Proceeds:</span>
                        <span className="font-bold">
                          {formatCurrency(calculateTotal(), stock.currency_code)}
                        </span>
                      </div>
                      
                      <Button
                        className="w-full mt-4"
                        onClick={executeTrade}
                        disabled={
                          dataLoading || 
                          wallets.length === 0 || 
                          !quantity || 
                          isNaN(parseFloat(quantity)) || 
                          parseFloat(quantity) <= 0
                        }
                      >
                        {dataLoading ? "Processing..." : "Sell Stock"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>About {stock.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>
                  {stock.name} ({stock.symbol}) is a publicly traded company on the {stock.market} market. 
                  The stock is traded in {stock.currency_code} and is available for international investors.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium">Market</h4>
                    <p className="text-sm text-muted-foreground">{stock.market}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Currency</h4>
                    <p className="text-sm text-muted-foreground">{stock.currency_code}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Current Price</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(stock.last_price, stock.currency_code)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Day Range</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(stock.day_low || stock.last_price * 0.98, stock.currency_code)} - {formatCurrency(stock.day_high || stock.last_price * 1.02, stock.currency_code)}
                    </p>
                  </div>
                  {stock.volume && (
                    <div>
                      <h4 className="text-sm font-medium">Volume</h4>
                      <p className="text-sm text-muted-foreground">
                        {stock.volume.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {stock.market_cap && (
                    <div>
                      <h4 className="text-sm font-medium">Market Cap</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(stock.market_cap, stock.currency_code)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Market Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Trading Hours</h4>
                  <p className="text-sm text-muted-foreground">
                    {stock.market === "NASDAQ" || stock.market === "NYSE" ? "9:30 AM - 4:00 PM ET" : 
                     stock.market === "Nikkei" ? "9:00 AM - 3:00 PM JST" :
                     stock.market === "FTSE" ? "8:00 AM - 4:30 PM GMT" :
                     stock.market === "DAX" ? "9:00 AM - 5:30 PM CET" :
                     "9:15 AM - 3:30 PM IST"}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Exchange Fees</h4>
                  <p className="text-sm text-muted-foreground">
                    0.1% per transaction
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Tax Information</h4>
                  <p className="text-sm text-muted-foreground">
                    Profits may be subject to local and international taxes. Please consult a tax professional.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 