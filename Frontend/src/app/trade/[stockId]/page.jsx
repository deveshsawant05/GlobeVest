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
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, BarChart, Bar, ReferenceLine,
  ComposedChart, Scatter
} from "recharts";

const timeRangeOptions = {
  "5m": { label: "5 Min", interval: 5 * 60 * 1000, dataPoints: 60, format: "HH:mm:ss" },
  "1h": { label: "1 Hour", interval: 60 * 60 * 1000, dataPoints: 60, format: "HH:mm" },
  "1d": { label: "1 Day", interval: 24 * 60 * 60 * 1000, dataPoints: 24, format: "HH:mm" },
  "1M": { label: "1 Month", interval: 30 * 24 * 60 * 60 * 1000, dataPoints: 30, format: "MMM dd" }
};

export default function TradePage() {
  const { stockId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const socket = useSocket('ws://localhost:5001');
  
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
  
  // Fetch data on time range change - using useCallback to memoize the function
  const fetchPriceHistoryForTimeRange = useCallback(async (range) => {
    if (!stockId || !stock) return;
    
    console.log("Fetching price history for range:", range);
    setPriceHistory([]); // Clear existing data
    
    try {
      setDataLoading(true); // Use dataLoading instead of initialLoading
      const config = timeRangeOptions[range];
      
      // Calculate the start time based on the selected range
      const now = new Date();
      let startTime;
      
      switch(range) {
        case "5m":
          startTime = new Date(now.getTime() - (5 * 60 * 1000));
          break;
        case "1h":
          startTime = new Date(now.getTime() - (60 * 60 * 1000));
          break;
        case "1d":
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          break;
        case "1M":
          startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        default:
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Default to 1 day
      }
      
      // Try to fetch from the backend API
      const response = await StocksAPI.getStockHistory(stockId, range);
      
      if (response.data && response.data.length > 0) {
        // Format the data for the chart
        const formattedData = response.data.map((point, index) => {
          const pointDate = new Date(point.timestamp);
          return {
            date: pointDate.toLocaleDateString(),
            time: pointDate.toLocaleTimeString(),
            fullDate: pointDate,
            price: parseFloat(point.price),
            open: parseFloat(point.open || point.price),
            high: parseFloat(point.high || point.price * 1.005),
            low: parseFloat(point.low || point.price * 0.995),
            close: parseFloat(point.price),
            volume: point.volume || Math.floor(Math.random() * 10000) + 1000,
            // Ensure each point has a unique id
            id: index
          };
        });
        
        console.log("Formatted chart data for range:", range, formattedData);
        setPriceHistory(formattedData);
        priceHistoryRef.current = formattedData;
      } else {
        // If no data, generate realistic mock data
        generateStockData(stock.last_price, config.dataPoints, config.interval, startTime);
      }
      setDataLoading(false);
    } catch (error) {
      console.error("Error fetching price history:", error);
      // Fallback to generated data
      const config = timeRangeOptions[range];
      const now = new Date();
      let startTime = new Date(now.getTime() - (config.dataPoints * config.interval));
      generateStockData(stock.last_price, config.dataPoints, config.interval, startTime);
      setDataLoading(false);
    }
  }, [stockId, stock]);
  
  // Use effect to respond to time range changes
  useEffect(() => {
    if (!stockId || !stock) return;
    console.log("TIME RANGE CHANGED TO:", timeRange);
    fetchPriceHistoryForTimeRange(timeRange);
  }, [timeRange, fetchPriceHistoryForTimeRange]);
  
  // Subscribe to real-time stock updates
  useEffect(() => {
    if (!stockId || !socket) return;
    
    // Subscribe to stock updates
    socket.emit('subscribeToStock', stockId);
    
    // Handler for stock updates
    const handleStockUpdate = (updatedStock) => {
      setStock(prevStock => {
        if (!prevStock) return updatedStock;
        
        // Only append a new price point if the price actually changed
        if (prevStock.last_price !== updatedStock.last_price) {
          appendPricePoint(updatedStock.last_price);
        }
        
        return updatedStock;
      });
    };
    
    // Set up event listener for stock updates
    socket.on('stockUpdate', handleStockUpdate);
    
    // Cleanup subscription
    return () => {
      socket.off('stockUpdate', handleStockUpdate);
      socket.emit('unsubscribeFromStock', stockId);
    };
  }, [stockId, socket]);
  
  // Append a new price point to the existing history
  const appendPricePoint = (newPrice) => {
    setPriceHistory(prev => {
      if (prev.length === 0) return prev;
      
      // Create a copy of the last entry
      const lastPoint = { ...prev[prev.length - 1] };
      const now = new Date();
      
      // Create a new point
      const newPoint = {
        ...lastPoint,
        fullDate: now,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        price: parseFloat(newPrice),
        close: parseFloat(newPrice),
        // Update high/low if needed
        high: Math.max(lastPoint.high, parseFloat(newPrice)),
        low: Math.min(lastPoint.low, parseFloat(newPrice)),
        // Generate a volume that correlates with price change
        volume: Math.floor(Math.random() * 5000) + 500,
        id: Date.now() // Add unique ID for each point
      };
      
      // If we're in a timeframe where we should add a new point
      const shouldAddNewPoint = shouldAddNewDataPoint(lastPoint.fullDate, now, timeRange);
      
      if (shouldAddNewPoint) {
        // Add as new point
        const newHistory = [...prev, newPoint];
        // If history is too long, remove oldest points
        if (newHistory.length > 100) {
          return newHistory.slice(newHistory.length - 100);
        }
        priceHistoryRef.current = newHistory;
        return newHistory;
      } else {
        // Update the last point
        const newHistory = [...prev.slice(0, -1), newPoint];
        priceHistoryRef.current = newHistory;
        return newHistory;
      }
    });
  };
  
  // Determine if we should add a new data point based on timeframe
  const shouldAddNewDataPoint = (lastTime, currentTime, range) => {
    if (!lastTime) return true;
    
    const timeDiff = currentTime - lastTime;
    
    switch (range) {
      case "5m":
        return timeDiff >= 5 * 1000; // Add a point every 5 seconds in 5min view
      case "1h":
        return timeDiff >= 60 * 1000; // Add a point every minute in 1h view
      case "1d":
        return timeDiff >= 15 * 60 * 1000; // Add a point every 15 minutes in 1d view
      case "1M":
        return timeDiff >= 24 * 60 * 60 * 1000; // Add a point every day in 1M view
      default:
        return timeDiff >= 60 * 1000; // Default to 1 minute
    }
  };
  
  // Generate realistic stock data for the chart
  const generateStockData = (currentPrice, numPoints, interval, startTime) => {
    // Base price and volatility
    const basePrice = currentPrice;
    const volatility = timeRange === "5m" ? 0.0005 : 
                       timeRange === "1h" ? 0.001 : 
                       timeRange === "1d" ? 0.003 : 0.01;
    
    // Generate realistic stock movement with proper OHLC data
    const now = new Date();
    const endTime = new Date(now);
    
    // Use provided startTime or calculate based on selected time range
    if (!startTime) {
      switch(timeRange) {
        case "5m":
          startTime = new Date(now.getTime() - (5 * 60 * 1000));
          break;
        case "1h":
          startTime = new Date(now.getTime() - (60 * 60 * 1000));
          break;
        case "1d":
          startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          break;
        case "1M":
          startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        default:
          startTime = new Date(endTime.getTime() - (numPoints * interval));
      }
    }
    
    console.log(`Generating mock data: ${timeRange} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    // Calculate the time step between each point
    const timeSpan = endTime.getTime() - startTime.getTime();
    const timeStep = timeSpan / (numPoints - 1);
    
    let lastPrice = basePrice;
    const data = [];
    
    for (let i = 0; i < numPoints; i++) {
      // Calculate precise time for this point
      const pointTime = new Date(startTime.getTime() + (i * timeStep));
      
      // Generate price movement
      const change = (Math.random() - 0.5) * volatility * lastPrice;
      const newPrice = lastPrice + change;
      
      // Generate OHLC data with more variation
      const open = lastPrice;
      const close = newPrice;
      const high = Math.max(open, close) + (Math.random() * volatility * lastPrice * 0.5);
      const low = Math.min(open, close) - (Math.random() * volatility * lastPrice * 0.5);
      
      // For volume, higher volatility = higher volume
      const priceChange = Math.abs(close - open);
      const volumeMultiplier = 1 + (priceChange / open) * 50;
      const volume = Math.floor((Math.random() * 5000 + 1000) * volumeMultiplier);
      
      // Add the data point
      data.push({
        fullDate: pointTime,
        date: pointTime.toLocaleDateString(),
        time: pointTime.toLocaleTimeString(),
        price: parseFloat(close.toFixed(2)),
        open: parseFloat(open.toFixed(2)), 
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume,
        // Use numeric index as ID to avoid issues with date keys
        id: i
      });
      
      lastPrice = close;
    }
    
    // Make sure the last price matches the current price
    if (data.length > 0) {
      data[data.length - 1].close = currentPrice;
      data[data.length - 1].price = currentPrice;
    }
    
    console.log("Generated chart data:", data);
    setPriceHistory(data);
    priceHistoryRef.current = data;
  };
  
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
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return "";
    
    const options = { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    };
    
    return date.toLocaleDateString(undefined, options);
  };
  
  // Calculate Y-axis domain with proper padding
  const calculateYAxisDomain = () => {
    if (!priceHistory || priceHistory.length === 0) return ['auto', 'auto'];
    
    const allPrices = priceHistory.flatMap(entry => [
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
  };

  // Get chart color based on price trend
  const getChartColor = () => {
    if (!priceHistory || priceHistory.length < 2) {
      return { stroke: "hsl(var(--primary))", fill: "hsl(var(--primary))", fillOpacity: 0.1 };
    }
    
    const firstPrice = priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].price;
    const isPositive = lastPrice >= firstPrice;
    
    return {
      stroke: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
      fill: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
      fillOpacity: 0.1
    };
  };
  
  // Format time based on selected time range - memoized to prevent re-rendering
  const formatChartTime = useCallback((timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    
    switch(timeRange) {
      case "5m":
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      case "1h":
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      case "1d":
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      case "1M":
      default:
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }, [timeRange]);
  
  // Memoize the chart color calculation to prevent unnecessary re-renders
  const chartColor = useMemo(() => getChartColor(), [priceHistory]);
  
  // Memoize the Y-axis domain calculation
  const yAxisDomain = useMemo(() => calculateYAxisDomain(), [priceHistory]);
  
  // Create a stable identifier for the chart to prevent re-renders
  const chartKey = useMemo(() => `chart-${timeRange}-${Date.now()}`, [timeRange]);
  
  // Simple static fake data for fallback
  const generateStaticFakeData = () => {
    const fakeData = [];
    const basePrice = stock ? stock.last_price : 100;
    
    for (let i = 0; i < 24; i++) {
      fakeData.push({
        id: i,
        price: basePrice * (1 + (Math.sin(i/5) * 0.05)),
        fullDate: new Date(Date.now() - (24-i) * 3600000)
      });
    }
    console.log("Generated static fake data:", fakeData);
    return fakeData;
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

  // Render the price chart with memoization
  const renderPriceChart = useMemo(() => {
    if (priceHistory.length === 0) return null;
    
    return (
      <LineChart
        data={priceHistory}
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
          domain={['dataMin', 'dataMax']}
          tickFormatter={(id) => {
            const item = priceHistory.find(p => p.id === id);
            return item && item.fullDate ? formatChartTime(item.fullDate) : '';
          }}
        />
        <YAxis 
          orientation="right"
          domain={yAxisDomain}
          tickFormatter={(value) => formatCurrency(value, stock?.currency_code).replace(/[^\d.]/g, '')}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="price"
          stroke={chartColor.stroke}
          strokeWidth={2}
          isAnimationActive={false}
          dot={false}
        />
      </LineChart>
    );
  }, [priceHistory, formatChartTime, yAxisDomain, stock, chartColor]);
  
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
                  <div className="flex items-center space-x-1 rounded-md bg-muted p-1 text-xs">
                    <button
                      onClick={(e) => { 
                        e.preventDefault();
                        console.log("Setting timeRange to 5m");
                        setTimeRange("5m");
                      }}
                      className={`rounded px-2 py-1 ${timeRange === "5m" ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
                      aria-pressed={timeRange === "5m"}
                    >
                      5M
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log("Setting timeRange to 1h");
                        setTimeRange("1h");
                      }}
                      className={`rounded px-2 py-1 ${timeRange === "1h" ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
                      aria-pressed={timeRange === "1h"}
                    >
                      1H
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log("Setting timeRange to 1d");
                        setTimeRange("1d");
                      }}
                      className={`rounded px-2 py-1 ${timeRange === "1d" ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
                      aria-pressed={timeRange === "1d"}
                    >
                      1D
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log("Setting timeRange to 1M");
                        setTimeRange("1M");
                      }}
                      className={`rounded px-2 py-1 ${timeRange === "1M" ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
                      aria-pressed={timeRange === "1M"}
                    >
                      1M
                    </button>
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
                        {dataLoading ? (
                          <div className="h-full w-full flex items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                          </div>
                        ) : priceHistory.length === 0 ? (
                          <LineChart
                            data={generateStaticFakeData()}
                            margin={{
                              top: 10,
                              right: 30,
                              left: 10,
                              bottom: 30,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="id" />
                            <YAxis orientation="right" />
                            <Line
                              type="monotone"
                              dataKey="price"
                              stroke="hsl(var(--primary))"
                              isAnimationActive={false}
                              dot={false}
                            />
                          </LineChart>
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