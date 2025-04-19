"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { WalletAPI, TransactionsAPI, TradesAPI, StocksAPI } from "@/lib/api";
import { useSocket } from "@/hooks/use-socket";

export default function DashboardPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [wallets, setWallets] = useState([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({});
  const [stockHoldings, setStockHoldings] = useState([]);
  const socket = useSocket(process.env.NEXT_PUBLIC_STOCK_MARKET_URL);

  // Fetch data when component mounts or currency changes
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch exchange rates first
        let ratesResponse;
        try {
          ratesResponse = await WalletAPI.getExchangeRates();
          setExchangeRates(ratesResponse.data);
        } catch (error) {
          console.error("Error fetching exchange rates:", error);
          // Fallback exchange rates if API fails
          setExchangeRates({
            'USD_EUR': 0.92, 'USD_GBP': 0.79, 'USD_JPY': 150.44, 'USD_INR': 83.12,
            'EUR_USD': 1.09, 'EUR_GBP': 0.86, 'EUR_JPY': 163.57, 'EUR_INR': 90.28,
            'GBP_USD': 1.27, 'GBP_EUR': 1.17, 'GBP_JPY': 191.13, 'GBP_INR': 105.66,
            'JPY_USD': 0.0067, 'JPY_EUR': 0.0061, 'JPY_GBP': 0.0052, 'JPY_INR': 0.55,
            'INR_USD': 0.012, 'INR_EUR': 0.011, 'INR_GBP': 0.0095, 'INR_JPY': 1.81
          });
        }
        
        // Fetch wallets data
        let walletsData = [];
        try {
          const walletsResponse = await WalletAPI.getUserWallets();
          walletsData = walletsResponse.data || [];
          setWallets(walletsData);
        } catch (error) {
          console.error("Error fetching wallets:", error);
          setWallets([]);
        }
        
        // Fetch stock holdings for portfolio value calculation
        let stocksData = [];
        try {
          const portfolioResponse = await StocksAPI.getUserPortfolio();
          stocksData = portfolioResponse.data.stocks || [];
          setStockHoldings(stocksData);
        } catch (error) {
          console.error("Error fetching portfolio:", error);
          setStockHoldings([]);
        }
        
        // Calculate total portfolio value including stocks
        const rates = ratesResponse?.data || exchangeRates;
        calculateTotalPortfolioValue(
          walletsData, 
          stocksData, 
          rates,
          selectedCurrency
        );
        
        // Fetch recent transactions and trades
        try {
          const transactionsResponse = await TransactionsAPI.getUserTransactions(1, 5);
          const tradesResponse = await TradesAPI.getUserTrades(1, 5);
          
          // Combine and sort transactions with trades
          const transactions = transactionsResponse.data.transactions || [];
          const trades = (tradesResponse.data.trades || []).map(trade => ({
            transaction_id: `trade-${trade.trade_id}`,
            transaction_type: trade.trade_type === 'buy' ? 'stock_buy' : 'stock_sell',
            amount: trade.total_amount,
            currency_code: trade.currency_code,
            created_at: trade.trade_date,
            description: `${trade.trade_type === 'buy' ? 'Bought' : 'Sold'} ${trade.quantity} ${trade.symbol}`
          }));
          
          // Combine both arrays and sort by created_at
          const allTransactions = [...transactions, ...trades].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
          ).slice(0, 5); // Take only the 5 most recent
          
          setRecentTransactions(allTransactions);
        } catch (error) {
          console.error("Error fetching transactions or trades:", error);
          setRecentTransactions([]);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [selectedCurrency]);

  // Effect to update stock prices via WebSocket
  useEffect(() => {
    if (!socket || stockHoldings.length === 0) return;

    const handleStockUpdate = (updatedStock) => {
      setStockHoldings(current => {
        const updated = current.map(stock => 
          stock.stock_id === updatedStock.stock_id 
            ? { ...stock, last_price: updatedStock.last_price }
            : stock
        );
        
        // Recalculate total portfolio value with updated stock prices
        calculateTotalPortfolioValue(wallets, updated, exchangeRates, selectedCurrency);
        return updated;
      });
    };

    // Subscribe to stock updates for stocks in portfolio
    stockHoldings.forEach(stock => {
      socket.emit('subscribeToStock', stock.stock_id);
    });

    socket.on('stockUpdate', handleStockUpdate);
    socket.on('stocksUpdate', (stocks) => {
      stocks.forEach(stock => {
        if (stockHoldings.some(s => s.stock_id === stock.stock_id)) {
          handleStockUpdate(stock);
        }
      });
    });

    return () => {
      // Unsubscribe on component unmount
      stockHoldings.forEach(stock => {
        socket.emit('unsubscribeFromStock', stock.stock_id);
      });
      socket.off('stockUpdate');
      socket.off('stocksUpdate');
    };
  }, [socket, stockHoldings, wallets, exchangeRates, selectedCurrency]);

  // Function to calculate total portfolio value including stocks
  const calculateTotalPortfolioValue = (wallets, stocks, rates, targetCurrency) => {
    if (!wallets.length || !rates || !Object.keys(rates).length) return;

    // Calculate wallet values in target currency
    const walletsValue = wallets.reduce((total, wallet) => {
      let convertedValue = parseFloat(wallet.balance);
      
      // Convert to target currency if needed
      if (wallet.currency_code !== targetCurrency) {
        const directRate = rates[`${wallet.currency_code}_${targetCurrency}`];
        const inverseRate = rates[`${targetCurrency}_${wallet.currency_code}`];
        
        if (directRate) {
          convertedValue *= directRate;
        } else if (inverseRate) {
          convertedValue /= inverseRate;
        } else {
          // Fallback to USD as intermediate if direct conversion not available
          const toUSD = rates[`${wallet.currency_code}_USD`] || (1 / rates[`USD_${wallet.currency_code}`]);
          const fromUSD = rates[`USD_${targetCurrency}`] || (1 / rates[`${targetCurrency}_USD`]);
          
          if (toUSD && fromUSD) {
            convertedValue = convertedValue * toUSD * fromUSD;
          }
        }
      }
      
      return total + convertedValue;
    }, 0);

    // Calculate stocks value in target currency
    const stocksValue = stocks.reduce((total, stock) => {
      let value = parseFloat(stock.quantity) * parseFloat(stock.last_price);
      
      // Convert to target currency if needed
      if (stock.currency_code !== targetCurrency) {
        const directRate = rates[`${stock.currency_code}_${targetCurrency}`];
        const inverseRate = rates[`${targetCurrency}_${stock.currency_code}`];
        
        if (directRate) {
          value *= directRate;
        } else if (inverseRate) {
          value /= inverseRate;
        } else {
          // Fallback to USD as intermediate
          const toUSD = rates[`${stock.currency_code}_USD`] || (1 / rates[`USD_${stock.currency_code}`]);
          const fromUSD = rates[`USD_${targetCurrency}`] || (1 / rates[`${targetCurrency}_USD`]);
          
          if (toUSD && fromUSD) {
            value = value * toUSD * fromUSD;
          }
        }
      }
      
      return total + value;
    }, 0);

    // Set total portfolio value
    setTotalPortfolioValue(walletsValue + stocksValue);
  };

  // Prepare data for wallet distribution chart
  // Only show top 4 currencies and group the rest as "Other"
  const prepareWalletDistributionData = () => {
    if (!wallets || wallets.length === 0) return [];
    
    // Get master wallet currency
    const masterWallet = wallets.find(wallet => wallet.is_master);
    const masterCurrency = masterWallet?.currency_code || selectedCurrency;
    
    // Only show wallets with non-zero balance
    const walletsWithBalance = wallets.filter(wallet => parseFloat(wallet.balance) > 0);
    
    // Convert all balances to selected currency
    const walletsWithConvertedBalance = walletsWithBalance.map(wallet => {
      let convertedBalance = parseFloat(wallet.balance);
      
      if (wallet.currency_code !== selectedCurrency && exchangeRates) {
        const directRate = exchangeRates[`${wallet.currency_code}_${selectedCurrency}`];
        const inverseRate = exchangeRates[`${selectedCurrency}_${wallet.currency_code}`];
        
        if (directRate) {
          convertedBalance *= directRate;
        } else if (inverseRate) {
          convertedBalance /= inverseRate;
        }
      }
      
      return {
        ...wallet,
        convertedBalance
      };
    });
    
    // Sort wallets by converted balance
    const sortedWallets = [...walletsWithConvertedBalance].sort((a, b) => 
      b.convertedBalance - a.convertedBalance
    );
    
    // Take top 4 wallets and group the rest as "Other"
    const topWallets = sortedWallets.slice(0, 4);
    const otherWallets = sortedWallets.slice(4);
    
    // Create chart data for top wallets
    const data = topWallets.map(wallet => ({
      name: wallet.currency_code,
      value: parseFloat(wallet.balance),
      convertedValue: wallet.convertedBalance,
      label: `${wallet.currency_code}: ${formatCurrency(wallet.balance, wallet.currency_code)}`
    }));
    
    // Add "Other" category if needed
    if (otherWallets.length > 0) {
      const otherValue = otherWallets.reduce(
        (sum, wallet) => sum + parseFloat(wallet.balance), 0
      );
      const otherConvertedValue = otherWallets.reduce(
        (sum, wallet) => sum + wallet.convertedBalance, 0
      );
      
      data.push({
        name: 'Other',
        value: otherValue,
        convertedValue: otherConvertedValue,
        label: `Other: ${formatCurrency(otherConvertedValue, selectedCurrency)}`
      });
    }
    
    return data;
  };
  
  const walletDistributionData = prepareWalletDistributionData();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your investment portfolio.
        </p>
        
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Portfolio Value
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm bg-transparent border-none focus:outline-none focus:ring-0"
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="INR">INR</option>
                  </select>
                  <div className="text-2xl font-bold">
                    {loading ? "Loading..." : formatCurrency(totalPortfolioValue, selectedCurrency)}
                  </div>
                </div>
                {!loading && (
                  <p className="text-xs text-muted-foreground">
                    Across {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} and {stockHoldings.length} stock{stockHoldings.length !== 1 ? 's' : ''}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Wallets
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "Loading..." : wallets.length}</div>
                {!loading && wallets.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Across {new Set(wallets.map(w => w.currency_code)).size} currencies
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Wallet Distribution</CardTitle>
                <CardDescription>
                  Allocation of funds across wallets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <p>Loading wallet data...</p>
                  </div>
                ) : wallets.length > 0 ? (
                  <div className="space-y-4">
                    {prepareWalletDistributionData().map((wallet, index) => (
                      <div key={wallet.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ 
                              backgroundColor: [
                                'hsl(215, 90%, 52%)', // Blue
                                'hsl(150, 60%, 48%)', // Green
                                'hsl(45, 95%, 58%)',  // Yellow
                                'hsl(10, 85%, 57%)',  // Red
                                'hsl(280, 60%, 65%)'  // Purple
                              ][index % 5]
                            }}
                          />
                          <span className="font-medium">{wallet.name}</span>
                        </div>
                        <div className="font-medium">
                          {formatCurrency(wallet.value, wallet.name !== 'Other' ? wallet.name : selectedCurrency)}
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Total Balance</span>
                        <span>{formatCurrency(totalPortfolioValue, selectedCurrency)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No wallet data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  Your latest financial activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <p>Loading transactions...</p>
                  </div>
                ) : recentTransactions.length > 0 ? (
                  <div className="space-y-4">
                    {recentTransactions.map((transaction) => (
                      <div key={transaction.transaction_id} className="flex items-center">
                        <div className={`mr-4 rounded-full p-2 ${
                          transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in' || transaction.transaction_type === 'stock_sell'
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in' || transaction.transaction_type === 'stock_sell' ? (
                            <ArrowUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {transaction.transaction_type === 'stock_buy' 
                              ? 'Stock Purchase' 
                              : transaction.transaction_type === 'stock_sell'
                                ? 'Stock Sale'
                                : transaction.transaction_type.charAt(0).toUpperCase() + 
                                  transaction.transaction_type.slice(1).replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.description || new Date(transaction.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className={`font-medium ${
                          transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in' || transaction.transaction_type === 'stock_sell'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in' || transaction.transaction_type === 'stock_sell'
                            ? '+'
                            : '-'
                          }
                          {formatCurrency(transaction.amount, transaction.currency_code || selectedCurrency)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-muted-foreground">No recent transactions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}