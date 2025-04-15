"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { WalletAPI, TransactionsAPI } from "@/lib/api";

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
        
        // Fetch recent transactions
        const transactionsResponse = await TransactionsAPI.getUserTransactions(1, 5);
        setRecentTransactions(transactionsResponse.data.transactions);
        
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
  const walletDistributionData = wallets.map(wallet => ({
    name: wallet.currency_code,
    value: parseFloat(wallet.balance)
  }));

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
              <CardContent className="pl-2">
                <div className="h-[200px]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <p>Loading chart data...</p>
                    </div>
                  ) : wallets.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={walletDistributionData}
                        margin={{
                          top: 5,
                          right: 10,
                          left: 10,
                          bottom: 20,
                        }}
                        barSize={40}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="name" 
                          className="text-xs text-muted-foreground"
                        />
                        <YAxis className="text-xs text-muted-foreground" />
                        <Tooltip 
                          formatter={(value) => [`${formatCurrency(value, selectedCurrency)}`, 'Balance']}
                          labelFormatter={(value) => `${value} Wallet`}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            color: 'hsl(var(--card-foreground))'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--muted-foreground))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-muted-foreground">No wallet data available</p>
                    </div>
                  )}
                </div>
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
                          transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in'
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in' ? (
                            <ArrowUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {transaction.transaction_type.charAt(0).toUpperCase() + 
                             transaction.transaction_type.slice(1).replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className={`font-medium ${
                          transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'conversion_in'
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