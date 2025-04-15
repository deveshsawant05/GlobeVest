"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import { StocksAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/use-socket";

export default function MarketsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [markets, setMarkets] = useState([
    { id: "NASDAQ", name: "NASDAQ (US)", currency: "USD" },
    { id: "TSE", name: "Tokyo Stock Exchange", currency: "JPY" },
    { id: "LSE", name: "London Stock Exchange", currency: "GBP" },
    { id: "XETRA", name: "XETRA (Germany)", currency: "EUR" },
    { id: "NSE", name: "National Stock Exchange (India)", currency: "INR" },
  ]);
  const [activeMarket, setActiveMarket] = useState("NASDAQ");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const subscribedStocksRef = useRef(new Set());
  
  // Setup websocket connection for real-time price updates
  const socket = useSocket('ws://localhost:5001');
  
  // Listen for real-time stock updates
  useEffect(() => {
    if (!socket) return;
    
    // Handler for stock updates
    const handleStockUpdate = (updatedStock) => {
      setStocks(currentStocks => {
        // Create a new array with updated stock data
        return currentStocks.map(stock => {
          if (stock.stock_id === updatedStock.stock_id) {
            // Calculate change percentage from previous value if needed
            if (updatedStock.change_percentage === undefined && stock.last_price && updatedStock.last_price) {
              const change = ((updatedStock.last_price - stock.last_price) / stock.last_price) * 100;
              updatedStock.change_percentage = change;
            }
            return { ...stock, ...updatedStock };
          }
          return stock;
        });
      });
    };
    
    // Subscribe to stock price updates
    socket.on('stockPriceUpdate', handleStockUpdate);
    socket.on('stockUpdate', handleStockUpdate);
    
    // Cleanup on unmount
    return () => {
      socket.off('stockPriceUpdate', handleStockUpdate);
      socket.off('stockUpdate', handleStockUpdate);
    };
  }, [socket]);
  
  // Subscribe to all stocks in the current market
  useEffect(() => {
    if (!socket || !stocks.length) return;
    
    // Get all stock IDs for the current market
    const stockIds = stocks.map(stock => stock.stock_id);
    
    // Subscribe to each stock if not already subscribed
    stockIds.forEach(stockId => {
      if (!subscribedStocksRef.current.has(stockId)) {
        socket.emit('subscribeToStock', stockId);
        subscribedStocksRef.current.add(stockId);
      }
    });
    
    // Cleanup subscriptions on market change or component unmount
    return () => {
      stockIds.forEach(stockId => {
        if (subscribedStocksRef.current.has(stockId)) {
          socket.emit('unsubscribeFromStock', stockId);
          subscribedStocksRef.current.delete(stockId);
        }
      });
    };
  }, [socket, stocks, activeMarket]);
  
  // Fetch stocks for the active market
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setLoading(true);
        // Clear subscriptions when market changes
        subscribedStocksRef.current = new Set();
        
        const response = await StocksAPI.getStocksByMarket(activeMarket);
        setStocks(response.data);
      } catch (error) {
        console.error("Error fetching stocks:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load stock data",
        });
        
        // If there's no data yet, seed some demo data
        if (error.response?.status === 404) {
          try {
            await StocksAPI.seedStockData();
            toast({
              title: "Demo Data",
              description: "Initializing demo stock data for testing",
            });
            
            // Try fetching again after seeding
            const retryResponse = await StocksAPI.getStocksByMarket(activeMarket);
            setStocks(retryResponse.data);
          } catch (seedError) {
            console.error("Error seeding stock data:", seedError);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
  }, [activeMarket, toast]);

  // Handle manual price refresh
  const handleRefreshPrices = async () => {
    try {
      const response = await StocksAPI.updateStockPrices();
      toast({
        title: "Prices Updated",
        description: "Stock prices have been refreshed",
      });
    } catch (error) {
      console.error("Error updating prices:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update stock prices",
      });
    }
  };

  // Filter stocks based on search query
  const filteredStocks = stocks.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00%';
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Navigate to trading page for a specific stock
  const goToTrading = (stockId) => {
    router.push(`/trade/${stockId}`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Global Markets</h1>
          <p className="text-muted-foreground">
            Explore stock indices from markets around the world
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full max-w-lg">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by stock symbol or name..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleRefreshPrices} 
              variant="outline"
              className="w-full sm:w-auto"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Refresh Prices
            </Button>
          </div>

          <Tabs
            defaultValue={activeMarket}
            value={activeMarket}
            onValueChange={setActiveMarket}
            className="space-y-4"
          >
            <div className="overflow-x-auto">
              <TabsList className="flex w-full sm:grid sm:grid-cols-2 md:grid-cols-5">
                {markets.map((market) => (
                  <TabsTrigger key={market.id} value={market.id} className="whitespace-nowrap">
                    {market.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {markets.map((market) => (
              <TabsContent key={market.id} value={market.id} className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>{market.name} Stock Index</CardTitle>
                    <CardDescription>
                      Showing {filteredStocks.length} stocks in {market.currency}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Symbol</TableHead>
                            <TableHead className="whitespace-nowrap hidden sm:table-cell">Name</TableHead>
                            <TableHead className="whitespace-nowrap">Price ({market.currency})</TableHead>
                            <TableHead className="whitespace-nowrap">Change</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8">
                                <div className="flex justify-center">
                                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">Loading stock data...</p>
                              </TableCell>
                            </TableRow>
                          ) : filteredStocks.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8">
                                <p>No stocks found matching your search.</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredStocks.map((stock) => {
                              const changePercent = parseFloat(stock.change_percentage);
                              const isPositive = changePercent >= 0;
                              
                              return (
                                <TableRow key={stock.stock_id} className="cursor-pointer hover:bg-muted/50" onClick={() => goToTrading(stock.stock_id)}>
                                  <TableCell className="font-medium">{stock.symbol}</TableCell>
                                  <TableCell className="hidden sm:table-cell">{stock.name}</TableCell>
                                  <TableCell>{formatCurrency(stock.last_price, market.currency)}</TableCell>
                                  <TableCell>
                                    <div className={`flex items-center text-sm whitespace-nowrap ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {isPositive ? (
                                        <TrendingUp className="mr-1 h-4 w-4" />
                                      ) : (
                                        <TrendingDown className="mr-1 h-4 w-4" />
                                      )}
                                      {formatPercentage(changePercent)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="hidden sm:block">
                                      <StockDetailDialog stock={stock} market={market} onTrade={() => goToTrading(stock.stock_id)} />
                                    </div>
                                    <div className="sm:hidden">
                                      <Button size="sm" onClick={(e) => { e.stopPropagation(); goToTrading(stock.stock_id); }}>
                                        Trade
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StockDetailDialog({ stock, market, onTrade }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  
  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00%';
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };
  
  const getMarketCap = () => {
    if (!stock.market_cap) return "N/A";
    return formatCurrency(stock.market_cap, market.currency);
  };
  
  const getYearRange = () => {
    if (!stock.day_low || !stock.day_high) return "N/A";
    return `${formatCurrency(stock.day_low, market.currency)} - ${formatCurrency(stock.day_high, market.currency)}`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">View</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {stock.symbol} - {stock.name}
          </DialogTitle>
          <DialogDescription>
            {market.name} • {market.currency}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-3xl font-bold">
                {formatCurrency(stock.last_price, market.currency)}
              </p>
              <p className={`text-sm ${parseFloat(stock.change_percentage) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(stock.change_value || 0, market.currency)} ({formatPercentage(stock.change_percentage)})
              </p>
            </div>
            <Button onClick={() => { onTrade(); setIsOpen(false); }}>
              Trade Now
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Previous Close</p>
              <p className="font-medium">{formatCurrency(stock.previous_close || 0, market.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Volume</p>
              <p className="font-medium">{stock.volume ? stock.volume.toLocaleString() : "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Market Cap</p>
              <p className="font-medium">{getMarketCap()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Day Range</p>
              <p className="font-medium">{getYearRange()}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 