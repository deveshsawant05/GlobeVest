"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { WalletAPI, TransactionsAPI, TradesAPI } from "@/lib/api";

export default function DashboardPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [wallets, setWallets] = useState([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data when component mounts or currency changes
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch wallets data
        const walletsResponse = await WalletAPI.getUserWallets();
        setWallets(walletsResponse.data);
        
        // Fetch total portfolio value with correct currency conversion
        const portfolioResponse = await WalletAPI.getTotalBalance(selectedCurrency);
        setTotalPortfolioValue(portfolioResponse.data.totalBalance);
        
        // Fetch recent transactions and trades
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
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data");
        setLoading(false);
      }
    }
    
    fetchData();
  }, [selectedCurrency]);

  // Prepare data for wallet distribution chart
  // Only show top 4 currencies and group the rest as "Other"
  const prepareWalletDistributionData = () => {
    if (!wallets || wallets.length === 0) return [];
    
    // Get master wallet currency
    const masterWallet = wallets.find(wallet => wallet.is_master);
    const masterCurrency = masterWallet?.currency_code || selectedCurrency;
    
    // Only show wallets with non-zero balance
    const walletsWithBalance = wallets.filter(wallet => parseFloat(wallet.balance) > 0);
    
    // Sort wallets by balance (converted to master currency)
    const sortedWallets = [...walletsWithBalance].sort((a, b) => {
      const aBalance = parseFloat(a.balance);
      const bBalance = parseFloat(b.balance);
      return bBalance - aBalance;
    });
    
    // Take top 4 wallets and group the rest as "Other"
    const topWallets = sortedWallets.slice(0, 4);
    const otherWallets = sortedWallets.slice(4);
    
    // Create chart data for top wallets
    const data = topWallets.map(wallet => ({
      name: wallet.currency_code,
      value: parseFloat(wallet.balance),
      label: `${wallet.currency_code}: ${formatCurrency(wallet.balance, wallet.currency_code)}`
    }));
    
    // Add "Other" category if needed
    if (otherWallets.length > 0) {
      const otherValue = otherWallets.reduce((sum, wallet) => 
        sum + parseFloat(wallet.balance), 0
      );
      
      data.push({
        name: 'Other',
        value: otherValue,
        label: `Other: ${formatCurrency(otherValue, masterCurrency)}`
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
                    Across {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
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
                          {formatCurrency(wallet.value, wallet.name)}
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