"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { StocksAPI, WalletAPI, TradesAPI } from "@/lib/api";
import { STOCK_MARKET_WS_URL } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowDownIcon, ArrowUpIcon, PieChartIcon, TrendingUpIcon, DollarSign, Wallet, LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { io } from "socket.io-client";

// Color scheme for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// WebSocket connection URL (using environment variable or fallback to localhost)
const STOCK_WS_URL = STOCK_MARKET_WS_URL;

export default function PortfolioPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portfolio, setPortfolio] = useState({
    stocks: [],
    totalInvestment: 0,
    totalCurrentValue: 0,
    profitLoss: 0,
    profitLossPercentage: 0,
    marketDistribution: [],
    currencyBreakdown: [],
    assetsCount: 0
  });
  const [wallets, setWallets] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [stocksByWallet, setStocksByWallet] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Store stock data in ref to avoid unnecessary rerenders with WebSocket updates
  const stocksRef = useRef(new Map());
  const socketRef = useRef(null);
  const tradesRef = useRef([]);
  
  // Connect to WebSocket and handle real-time updates
  useEffect(() => {
    // Initial data fetch (still needed for trades and wallets)
    fetchInitialData();
    
    // Connect to WebSocket server
    const socket = io(STOCK_WS_URL, {
      reconnectionDelayMax: 10000,
      withCredentials: true,
      transports: ['websocket'], // Force WebSocket transport only, skip polling
      extraHeaders: {
        "Origin": window.location.origin
      }
    });
    
    socketRef.current = socket;
    
    // Handle connection events
    socket.on("connect", () => {
      console.log("Connected to Stock Market WebSocket");
      setError(null); // Clear any previous connection errors
    });
    
    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      
      // Set a more user-friendly error message
      setError("Unable to connect to real-time stock data. Using latest available data instead.");
      
      // Even if WebSocket fails, we can still show portfolio with data from regular API
      if (stocksRef.current.size > 0) {
        processPortfolioData();
      }
    });
    
    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
    
    // Handle initial stock data
    socket.on("stocksInitial", (stocksData) => {
      console.log(`Received initial data for ${stocksData.length} stocks via WebSocket`);
      
      // Use the updateStockRef function to update our stock references
      updateStockRef(stocksData);
      setLastUpdate(new Date());
    });
    
    // Handle stock updates
    socket.on("stocksUpdate", (updatedStocks) => {
      // Filter stocks that are in our portfolio
      const portfolioSymbols = Array.from(tradesRef.current)
        .map(trade => trade.symbol)
        .filter((v, i, a) => a.indexOf(v) === i); // Get unique symbols
      
      const relevantUpdates = updatedStocks.filter(stock => 
        portfolioSymbols.includes(stock.symbol)
      );
      
      // Only update if we have relevant stocks
      if (relevantUpdates.length > 0) {
        updateStockRef(relevantUpdates);
        setLastUpdate(new Date());
      }
    });
    
    // Handle individual stock updates (if subscribed)
    socket.on("stockUpdate", (stock) => {
      // Check if this stock is in our portfolio by symbol
      const portfolioSymbols = Array.from(tradesRef.current)
        .map(trade => trade.symbol)
        .filter((v, i, a) => a.indexOf(v) === i); // Get unique symbols
      
      if (portfolioSymbols.includes(stock.symbol)) {
        updateStockRef([stock]); // Wrap single stock in array for updateStockRef
        setLastUpdate(new Date());
      }
    });
    
    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Disconnected from Stock Market WebSocket");
    });
    
    // Cleanup on component unmount
    return () => {
      if (socket) {
        console.log("Closing Stock Market WebSocket connection");
        socket.disconnect();
      }
    };
  }, []);
  
  // Fetch initial data for trades and wallets (not stocks - those come from WebSocket)
  const fetchInitialData = async () => {
      try {
        setIsLoading(true);
      
      // Fetch user's portfolio of stocks - we'll use this for stock IDs,
      // but we'll get the current prices from WebSocket
        const portfolioResponse = await StocksAPI.getUserPortfolio();
        
        // Fetch user's wallets
        const walletsResponse = await WalletAPI.getUserWallets();
        
      // Fetch trades for additional stock info
      const tradesResponse = await TradesAPI.getUserTrades(1, 1000);
      
      const walletData = walletsResponse.data || [];
      let stocksData = portfolioResponse.data?.stocks || [];
      const tradesData = tradesResponse.data?.trades || [];
      
      // Store trade data for real-time processing
      tradesRef.current = tradesData;
      
      // Set default master wallet currency
      const masterWallet = walletData.find(w => w.is_master);
      if (masterWallet) {
        setSelectedCurrency(masterWallet.currency_code);
      }

      // If no stocks data but we have trades, build stock holdings from trade history
      if (stocksData.length === 0 && tradesData.length > 0) {
        console.log("Building stock portfolio from trade history");
        const stockHoldings = {};
        
        // Process trades to build stock positions
        tradesData.forEach(trade => {
          const symbol = trade.symbol;
          const quantity = parseFloat(trade.quantity);
          const price = parseFloat(trade.price);
          const totalAmount = parseFloat(trade.total_amount);
          const isBuy = trade.trade_type === 'buy';
          
          if (!stockHoldings[symbol]) {
            stockHoldings[symbol] = {
              symbol,
              name: trade.name || symbol,
              market: trade.market,
              currency_code: trade.currency_code,
              quantity: 0,
              total_cost: 0,
              total_sold: 0,
              current_price: price // use latest trade price as current price
            };
          }
          
          // Update our latest price info
          stockHoldings[symbol].current_price = price;
          
          // Update position based on trade type
          if (isBuy) {
            stockHoldings[symbol].quantity += quantity;
            stockHoldings[symbol].total_cost += totalAmount;
          } else {
            stockHoldings[symbol].quantity -= quantity;
            stockHoldings[symbol].total_sold += totalAmount;
          }
        });
        
        // Convert holdings object to array and filter out positions with zero quantity
        stocksData = Object.values(stockHoldings)
          .filter(stock => stock.quantity > 0)
          .map((stock, index) => ({
            ...stock,
            stock_id: `derived-${index}`,
            quantity: stock.quantity.toString(),
            current_price: stock.current_price.toString(),
            avg_buy_price: (stock.total_cost / stock.quantity).toString()
          }));
        
        console.log(`Built ${stocksData.length} stock positions from trade history`);
      }
      
      // If we have both regular stock data and trades, try to enhance the stock data with trade info
      if (stocksData.length > 0 && tradesData.length > 0) {
        stocksData = stocksData.map(stock => {
          // Find related trades for this stock
          const relatedTrades = tradesData.filter(trade => trade.symbol === stock.symbol);
          
          // If we have related trades, compute the average buy price
          if (relatedTrades.length > 0) {
            const totalBuyCost = relatedTrades
              .filter(trade => trade.trade_type === 'buy')
              .reduce((sum, trade) => sum + parseFloat(trade.total_amount), 0);
              
            const totalBuyQuantity = relatedTrades
              .filter(trade => trade.trade_type === 'buy')
              .reduce((sum, trade) => sum + parseFloat(trade.quantity), 0);
              
            if (totalBuyQuantity > 0 && !stock.avg_buy_price) {
              stock.avg_buy_price = (totalBuyCost / totalBuyQuantity).toString();
            }
          }
          
          return stock;
        });
      }
      
      // Store stock data and initialize portfolio
      stocksData.forEach(stock => {
        stocksRef.current.set(stock.stock_id, {
          ...stock,
          symbol: stock.symbol,
          last_price: parseFloat(stock.current_price)
        });
        
        // Subscribe to real-time updates for this stock
        if (socketRef.current) {
          socketRef.current.emit('subscribeToStock', stock.stock_id);
        }
      });
      
      // Store wallet data
      setWallets(walletData);
      
      // Process portfolio with the data we have, even without WebSocket data
      processPortfolioData(tradesData);
      
    } catch (err) {
      console.error("Error fetching portfolio data:", err);
      setError("Failed to load portfolio data. Please try again later.");
      setIsLoading(false);
    }
  };
  
  // Process portfolio data with current stock prices from WebSocket
  const processPortfolioData = (tradesData = null) => {
    try {
      // Get trades data - either from parameter or from reference
      const trades = tradesData || tradesRef.current || [];
      
      // Get current stocks from ref
      const stocksData = Array.from(stocksRef.current.values());
      
      if (trades.length === 0) {
        setIsLoading(false);
        setError("No trade data available to calculate portfolio");
        return;
      }
      
      // Find master wallet for currency reference
      const masterWallet = wallets.find(w => w.is_master);
      const masterCurrency = masterWallet?.currency_code || selectedCurrency;
      
      // Track all trade entries instead of aggregating by symbol
      const tradeEntries = {};
      const currencyTotals = {};
      
      // Create a mapping of stock symbols to their latest prices from WebSocket
      const latestPrices = {};
      const initialPrices = {}; // Store initial prices
      const refPrices = {}; // Store reference prices for percentage calculations
      
      stocksData.forEach(stock => {
        const symbol = stock.symbol;
        if (symbol) {
          // Use the last_price or current_price, prioritizing numeric values
          let price = parseFloat(stock.last_price) || parseFloat(stock.current_price);
          if (isNaN(price) && typeof stock.current_price === 'string') {
            price = parseFloat(stock.current_price);
          }
          if (!isNaN(price)) {
            latestPrices[symbol] = price;
            
            // Store the previous close or initial price for percentage calculations
            if (stock.previous_close) {
              refPrices[symbol] = parseFloat(stock.previous_close);
            } else {
              refPrices[symbol] = price; // Use current price if no previous price
            }
            
            // Store initial price if this is first load (for initializing percentages correctly)
            if (!initialPrices[symbol]) {
              initialPrices[symbol] = price;
            }
          }
        }
      });
      
      // Currency conversion rates (simplified - in a real app, these would come from an API)
      // For demo, assume we have some fixed conversion rates to master currency
      const conversionRates = {
        USD: 1.0,
        EUR: 1.1,
        GBP: 1.3,
        JPY: 0.0091,
        INR: 0.012,
        AUD: 0.65,
        CAD: 0.72,
        // Add more currencies as needed
      };
      
      // Ensure we have the master currency in our rates
      if (!conversionRates[masterCurrency]) {
        conversionRates[masterCurrency] = 1.0;
      }
      
      // Track unique stock symbols to calculate assets count correctly
      const uniqueStockSymbols = new Set();
      
      // Group trades by currency and symbol for summary calculations
      const holdingsByCurrency = {};
      
      // Process all trades to build individual trade entries
      trades.forEach(trade => {
        const symbol = trade.symbol;
        const currency = trade.currency_code || masterCurrency;
        const isBuy = trade.trade_type === 'buy';
        
        // Add to unique symbols set to track assets count correctly
        uniqueStockSymbols.add(symbol);
        
        // Skip if we don't need this trade (e.g., sell of a stock we no longer track)
        if (!isBuy && !latestPrices[symbol]) return;
        
        // Initialize currency tracking if needed
        if (!currencyTotals[currency]) {
          currencyTotals[currency] = {
            totalInvestment: 0,
            totalCurrentValue: 0,
            profitLoss: 0,
            profitLossPercentage: 0
          };
          tradeEntries[currency] = [];
          holdingsByCurrency[currency] = {};
        }
        
        // Initialize holdings tracking for this currency and symbol
        if (!holdingsByCurrency[currency][symbol]) {
          holdingsByCurrency[currency][symbol] = {
            symbol,
            name: trade.name || symbol,
            market: trade.market,
            currency_code: currency,
            quantity: 0,
            totalCost: 0,
            currentValue: 0,
            profitLoss: 0,
            refPrice: refPrices[symbol] || 0
          };
        }
        
        // Get trade details
        const tradeId = trade.trade_id || `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const quantity = parseFloat(trade.quantity);
        const price = parseFloat(trade.price);
        const totalAmount = parseFloat(trade.total_amount);
        // Fix invalid date issue by ensuring proper date format
        const tradeDate = trade.trade_date ? new Date(trade.trade_date) : new Date();
        
        // Skip if it's a sell - we'll handle those separately
        if (!isBuy) return;
        
        // Get current price from WebSocket data or fallback to trade price
        const currentPrice = latestPrices[symbol] !== undefined ? latestPrices[symbol] : price;
        const currentValue = currentPrice * quantity;
        const profitLoss = currentValue - totalAmount;
        const profitLossPercentage = totalAmount > 0 ? (profitLoss / totalAmount) * 100 : 0;
        
        // Create trade entry
        const entry = {
          id: tradeId,
          symbol,
          name: trade.name || symbol,
          market: trade.market,
          currency_code: currency,
          quantity,
          purchase_price: price,
          total_cost: totalAmount,
          current_price: currentPrice,
          current_value: currentValue,
          profit_loss: profitLoss,
          profit_loss_percentage: profitLossPercentage,
          trade_date: tradeDate,
          investment: totalAmount, // Add this for summary calculations
          // Calculate correct price change based on reference price
          price_change_percent: refPrices[symbol] ? 
            ((currentPrice - refPrices[symbol]) / refPrices[symbol]) * 100 : 0
        };
        
        tradeEntries[currency].push(entry);
        
        // Update currency totals
        currencyTotals[currency].totalInvestment += totalAmount;
        currencyTotals[currency].totalCurrentValue += currentValue;
        currencyTotals[currency].profitLoss += profitLoss;
        
        // Update holdings information for this currency and symbol
        holdingsByCurrency[currency][symbol].quantity += quantity;
        holdingsByCurrency[currency][symbol].totalCost += totalAmount;
        holdingsByCurrency[currency][symbol].currentValue += currentValue;
        holdingsByCurrency[currency][symbol].profitLoss += profitLoss;
      });
      
      // Calculate percentage for each currency and format holdings as array
      const holdingsArrayByCurrency = {};
      
      Object.keys(currencyTotals).forEach(currency => {
        const { totalInvestment, profitLoss } = currencyTotals[currency];
        currencyTotals[currency].profitLossPercentage = 
          totalInvestment > 0 ? (profitLoss / totalInvestment) * 100 : 0;
          
        // Sort trade entries by date (newest first)
        if (tradeEntries[currency]) {
          tradeEntries[currency].sort((a, b) => b.trade_date - a.trade_date);
        }
        
        // Format holdings as array and calculate percentages
        holdingsArrayByCurrency[currency] = Object.values(holdingsByCurrency[currency])
          .map(holding => {
            const avgBuyPrice = holding.quantity > 0 ? 
              holding.totalCost / holding.quantity : 0;
            
            return {
              ...holding,
              avgBuyPrice,
              profitLossPercentage: holding.totalCost > 0 ? 
                (holding.profitLoss / holding.totalCost) * 100 : 0
            };
          })
          .sort((a, b) => b.currentValue - a.currentValue); // Sort by value (highest first)
      });
      
      // Create currency breakdown for chart
      const currencyBreakdown = Object.keys(currencyTotals).map(currency => ({
        name: currency,
        value: currencyTotals[currency].totalCurrentValue
      }));
      
      // Calculate market distribution for chart
      const marketGroups = {};
      
      // Use holdings to calculate market distribution
      Object.values(holdingsByCurrency).forEach(currencyHoldings => {
        Object.values(currencyHoldings).forEach(holding => {
          if (!marketGroups[holding.market]) {
            marketGroups[holding.market] = 0;
          }
          
          // Convert to master currency for chart
          const conversionRate = (conversionRates[holding.currency_code] || 1.0) / 
            (conversionRates[masterCurrency] || 1.0);
          
          marketGroups[holding.market] += holding.currentValue * conversionRate;
        });
      });
      
      const marketDistribution = Object.keys(marketGroups).map(market => ({
        name: market,
        value: marketGroups[market]
      }));
      
      // Calculate overall totals converted to master currency
      let totalInvestment = 0;
      let totalCurrentValue = 0;
      let totalProfitLoss = 0;
      
      Object.keys(currencyTotals).forEach(currency => {
        // Apply conversion rate to convert to master currency
        const conversionRate = (conversionRates[currency] || 1.0) / 
          (conversionRates[masterCurrency] || 1.0);
        
        totalInvestment += currencyTotals[currency].totalInvestment * conversionRate;
        totalCurrentValue += currencyTotals[currency].totalCurrentValue * conversionRate;
        totalProfitLoss += currencyTotals[currency].profitLoss * conversionRate;
      });
      
      const totalProfitLossPercentage = totalInvestment > 0 
        ? (totalProfitLoss / totalInvestment) * 100 
        : 0;
      
      // Update state with real-time portfolio data
      setPortfolio({
        stocks: stocksData,
        totalInvestment,
        totalCurrentValue,
        profitLoss: totalProfitLoss,
        profitLossPercentage: totalProfitLossPercentage,
        marketDistribution,
        currencyBreakdown,
        assetsCount: uniqueStockSymbols.size, // Use the count of unique symbols
        currencyTotals, // Add currency totals for the new section
        holdingsByCurrency: holdingsArrayByCurrency // Add holdings by currency for the new section
      });
      
      // Store trade entries instead of aggregated stock data
      setStocksByWallet(tradeEntries);
      setIsLoading(false);
    } catch (err) {
      console.error("Error processing portfolio data:", err);
      setError("Error processing portfolio data with real-time prices.");
      setIsLoading(false);
    }
  };
  
  // Format percentages with sign and 2 decimal places
  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Update stockRef when we receive data from WebSocket
  const updateStockRef = (stocksData) => {
    if (!Array.isArray(stocksData)) return;
    
    let hasUpdates = false;
    
    // Update our stock reference with the latest data
    stocksData.forEach(stock => {
      const stockId = stock.stock_id;
      const symbol = stock.symbol;
      
      // Check if we already have this stock in our ref
      if (stocksRef.current.has(stockId)) {
        // Update existing stock with new price data
        const existingStock = stocksRef.current.get(stockId);
        const lastPrice = parseFloat(stock.current_price || stock.last_price);
        
        // Calculate price change (use previous close as reference or the existing last_price)
        const referencePrice = existingStock.initial_price || existingStock.previous_close || existingStock.last_price;
        const priceChange = lastPrice - referencePrice;
        const priceChangePercent = referencePrice ? (priceChange / referencePrice) * 100 : 0;
        
        stocksRef.current.set(stockId, {
          ...existingStock,
          current_price: stock.current_price,
          last_price: lastPrice,
          price_change: priceChange.toFixed(2),
          price_change_percent: priceChangePercent.toFixed(2),
          last_updated: new Date().toISOString()
        });
        
        hasUpdates = true;
      } else if (symbol) {
        // Try to find by symbol if not found by ID
        const existingStockBySymbol = Array.from(stocksRef.current.values())
          .find(s => s.symbol === symbol);
          
        if (existingStockBySymbol) {
          const lastPrice = parseFloat(stock.current_price || stock.last_price);
          
          // Calculate price change (use previous close as reference or the initial price)
          const referencePrice = existingStockBySymbol.initial_price || 
                                existingStockBySymbol.previous_close || 
                                existingStockBySymbol.last_price;
          const priceChange = lastPrice - referencePrice;
          const priceChangePercent = referencePrice ? (priceChange / referencePrice) * 100 : 0;
          
          stocksRef.current.set(existingStockBySymbol.stock_id, {
            ...existingStockBySymbol,
            current_price: stock.current_price,
            last_price: lastPrice,
            price_change: priceChange.toFixed(2),
            price_change_percent: priceChangePercent.toFixed(2),
            last_updated: new Date().toISOString()
          });
          
          hasUpdates = true;
        } else {
          // Add new stock to our reference
          const lastPrice = parseFloat(stock.current_price || stock.last_price);
          
          stocksRef.current.set(stockId, {
            ...stock,
            last_price: lastPrice,
            initial_price: lastPrice, // Store initial price for future reference
            price_change: 0,
            price_change_percent: 0
          });
          
          hasUpdates = true;
        }
      }
    });
    
    // Only process if we actually had updates
    if (hasUpdates) {
      processPortfolioData();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Overview of your investment portfolio and asset allocation
          {error ? (
            <span className="ml-2 text-xs text-primary-foreground">
              <Badge variant="outline" className="ml-2 bg-muted/30">
                Offline
                <span className="ml-1 h-2 w-2 rounded-full bg-muted inline-block"></span>
              </Badge>
            </span>
          ) : lastUpdate ? (
            <span className="ml-2 text-xs text-primary-foreground">
              <Badge variant="outline" className="ml-2">
                Real-time
                <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-primary inline-block"></span>
              </Badge>
              <span className="ml-2 text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            </span>
          ) : null}
        </p>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <p>Loading portfolio data...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : portfolio.stocks.length === 0 ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>No stocks in portfolio</AlertTitle>
              <AlertDescription>
                You don't have any stocks in your portfolio yet. Visit the Markets page to start investing.
              </AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Link href="/markets">
                <Button>Browse Markets</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Portfolio Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Investment
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(portfolio.totalInvestment, selectedCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total amount invested in stocks
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Current Value
                  </CardTitle>
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(portfolio.totalCurrentValue, selectedCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current market value of holdings
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Profit/Loss
                  </CardTitle>
                  {portfolio.profitLoss >= 0 ? (
                    <ArrowUpIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 text-red-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    portfolio.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {portfolio.profitLoss >= 0 ? '+' : ''}
                    {formatCurrency(portfolio.profitLoss, selectedCurrency)}
                  </div>
                  <p className={`text-xs ${
                    portfolio.profitLossPercentage >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatPercentage(portfolio.profitLossPercentage)}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Assets Count
                  </CardTitle>
                  <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {portfolio.assetsCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unique stocks in portfolio
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Portfolio Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Market Distribution</CardTitle>
                  <CardDescription>
                    Your portfolio across different markets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {portfolio.marketDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={portfolio.marketDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {portfolio.marketDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value, selectedCurrency)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No market data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Currency Allocation</CardTitle>
                  <CardDescription>
                    Portfolio distribution by currency
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {portfolio.currencyBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={portfolio.currencyBreakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {portfolio.currencyBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value, selectedCurrency)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No currency data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Holdings by Currency Tabs */}
            <Card>
              <CardHeader>
                <CardTitle>Holdings by Currency</CardTitle>
                <CardDescription>
                  Your investments broken down by currency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={Object.keys(stocksByWallet)[0] || "none"}>
                  <TabsList className="mb-4">
                    {Object.keys(stocksByWallet).map(currency => (
                      <TabsTrigger key={currency} value={currency}>
                        {currency}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {Object.keys(stocksByWallet).map(currency => {
                    const stocks = stocksByWallet[currency] || [];
                    const totalInvestment = stocks.reduce((sum, stock) => sum + parseFloat(stock.investment), 0);
                    const totalValue = stocks.reduce((sum, stock) => sum + parseFloat(stock.current_value), 0);
                    const totalProfitLoss = totalValue - totalInvestment;
                    const profitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
                    
                    return (
                      <TabsContent key={currency} value={currency}>
                        <div className="mb-4 p-4 border rounded-md bg-muted/30">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <h4 className="text-sm font-medium">Total Investment</h4>
                              <p className="text-xl font-bold">{formatCurrency(totalInvestment, currency)}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">Current Value</h4>
                              <p className="text-xl font-bold">{formatCurrency(totalValue, currency)}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">Profit/Loss</h4>
                              <p className={`text-xl font-bold ${totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totalProfitLoss, currency)}
                                <span className="text-sm ml-1">({formatPercentage(profitLossPercentage)})</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left font-medium">Symbol</th>
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Market</th>
                          <th className="px-4 py-2 text-right font-medium">Quantity</th>
                                <th className="px-4 py-2 text-right font-medium">Purchase Price</th>
                          <th className="px-4 py-2 text-right font-medium">Current Price</th>
                          <th className="px-4 py-2 text-right font-medium">Current Value</th>
                          <th className="px-4 py-2 text-right font-medium">Profit/Loss</th>
                                <th className="px-4 py-2 text-right font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                              {stocks.map((trade) => (
                                <tr key={trade.id} className="border-b">
                                  <td className="px-4 py-2">
                                    <div className="font-medium">{trade.symbol}</div>
                                  </td>
                                  <td className="px-4 py-2">
                                    {trade.name}
                                  </td>
                                  <td className="px-4 py-2">
                                    <Badge variant="outline">{trade.market}</Badge>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {trade.quantity}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {formatCurrency(trade.purchase_price, currency)}
                              </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    {formatCurrency(trade.current_price, currency)}
                              </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    {formatCurrency(trade.current_value, currency)}
                              </td>
                                  <td className={`px-4 py-2 text-right font-medium ${
                                    trade.profit_loss >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                    {trade.profit_loss >= 0 ? '+' : ''}
                                    {formatCurrency(trade.profit_loss, currency)}
                                <br />
                                <span className="text-xs">
                                      {formatPercentage(trade.profit_loss_percentage)}
                                </span>
                              </td>
                                  <td className="px-4 py-2 text-right text-muted-foreground">
                                    {trade.trade_date instanceof Date && !isNaN(trade.trade_date.getTime()) 
                                      ? trade.trade_date.toLocaleDateString() 
                                      : "N/A"}
                                  </td>
                            </tr>
                              ))}
                      </tbody>
                    </table>
                  </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Currency-Based Portfolio Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Currency-Based Portfolio Summary</CardTitle>
                <CardDescription>
                  Your investments broken down by currency with converted values in {selectedCurrency}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {portfolio.holdingsByCurrency && Object.keys(portfolio.holdingsByCurrency).map(currency => {
                    const holdings = portfolio.holdingsByCurrency[currency];
                    const currencyTotal = portfolio.currencyTotals[currency];
                    
                    return (
                      <div key={currency} className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">{currency} Holdings</h3>
                          <div className="text-right">
                            <div className="font-medium">
                              Total: {formatCurrency(currencyTotal.totalCurrentValue, currency)}
                            </div>
                            <div className={`text-sm ${
                              currencyTotal.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {currencyTotal.profitLoss >= 0 ? '+' : ''}{formatCurrency(currencyTotal.profitLoss, currency)}
                              <span className="ml-1">({formatPercentage(currencyTotal.profitLossPercentage)})</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="px-3 py-2 text-left font-medium">Symbol</th>
                                <th className="px-3 py-2 text-left font-medium">Market</th>
                                <th className="px-3 py-2 text-right font-medium">Quantity</th>
                                <th className="px-3 py-2 text-right font-medium">Avg Price</th>
                                <th className="px-3 py-2 text-right font-medium">Current Price</th>
                                <th className="px-3 py-2 text-right font-medium">% Change</th>
                                <th className="px-3 py-2 text-right font-medium">Value</th>
                                <th className="px-3 py-2 text-right font-medium">P/L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {holdings.map(holding => (
                                <tr key={holding.symbol} className="border-b">
                                  <td className="px-3 py-2">
                                    <div className="font-medium">{holding.symbol}</div>
                                    <div className="text-xs text-muted-foreground">{holding.name}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline">{holding.market}</Badge>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {holding.quantity.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatCurrency(holding.avgBuyPrice, currency)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatCurrency(holding.currentValue / holding.quantity, currency)}
                                  </td>
                                  <td className={`px-3 py-2 text-right ${
                                    holding.refPrice ? (holding.currentValue / holding.quantity > holding.refPrice ? 'text-green-500' : 'text-red-500') : ''
                                  }`}>
                                    {holding.refPrice ? formatPercentage(((holding.currentValue / holding.quantity) - holding.refPrice) / holding.refPrice * 100) : '0.00%'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatCurrency(holding.currentValue, currency)}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-medium ${
                                    holding.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'
                                  }`}>
                                    {holding.profitLoss >= 0 ? '+' : ''}
                                    {formatCurrency(holding.profitLoss, currency)}
                                    <br />
                                    <span className="text-xs">
                                      {formatPercentage(holding.profitLossPercentage)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
} 