"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculatePortfolioValue, formatCurrency, transactions, wallets } from "@/lib/data";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, LineChart, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

const portfolioData = [
  { name: "Jan", value: 4000 },
  { name: "Feb", value: 3000 },
  { name: "Mar", value: 5000 },
  { name: "Apr", value: 4500 },
  { name: "May", value: 6000 },
  { name: "Jun", value: 5500 },
  { name: "Jul", value: 7000 },
  { name: "Aug", value: 8000 },
  { name: "Sep", value: 7500 },
  { name: "Oct", value: 9000 },
  { name: "Nov", value: 8500 },
  { name: "Dec", value: 10000 },
];

export default function DashboardPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const portfolioValue = calculatePortfolioValue(selectedCurrency);
  
  // Get recent transactions (last 5)
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your investment portfolio.
        </p>
        
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    </select>
                    <div className="text-2xl font-bold">
                      {formatCurrency(portfolioValue, selectedCurrency)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                  </p>
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
                  <div className="text-2xl font-bold">{wallets.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {new Set(wallets.map(w => w.currency)).size} currencies
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Market Performance
                  </CardTitle>
                  <LineChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+12.5%</div>
                  <p className="text-xs text-muted-foreground">
                    Global market average YTD
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Portfolio Growth</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={portfolioData}
                        margin={{
                          top: 5,
                          right: 10,
                          left: 10,
                          bottom: 0,
                        }}
                      >
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                        <YAxis className="text-xs text-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            color: 'hsl(var(--card-foreground))'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--chart-1))"
                          fillOpacity={1}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
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
                  <div className="space-y-4">
                    {recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center">
                        <div className={`mr-4 rounded-full p-2 ${
                          transaction.type === 'deposit' || transaction.type === 'trade' && transaction.description.includes('Sold')
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {transaction.type === 'deposit' || transaction.type === 'trade' && transaction.description.includes('Sold') ? (
                            <ArrowUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className={`font-medium ${
                          transaction.type === 'deposit' || transaction.type === 'trade' && transaction.description.includes('Sold')
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {transaction.type === 'deposit' || transaction.type === 'trade' && transaction.description.includes('Sold')
                            ? '+'
                            : '-'
                          }
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Asset Allocation</CardTitle>
                  <CardDescription>
                    Your portfolio distribution across currencies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[
                          { name: "USD", USD: 5280, EUR: 0, GBP: 0, JPY: 0 },
                          { name: "EUR", USD: 5280, EUR: 3750, GBP: 0, JPY: 0 },
                          { name: "GBP", USD: 5280, EUR: 3750, GBP: 2100, JPY: 0 },
                          { name: "JPY", USD: 5280, EUR: 3750, GBP: 2100, JPY: 1032 },
                        ]}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                        <YAxis className="text-xs text-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            color: 'hsl(var(--card-foreground))'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="JPY"
                          stackId="1"
                          stroke="hsl(var(--chart-1))"
                          fill="hsl(var(--chart-1))"
                        />
                        <Area
                          type="monotone"
                          dataKey="GBP"
                          stackId="1"
                          stroke="hsl(var(--chart-2))"
                          fill="hsl(var(--chart-2))"
                        />
                        <Area
                          type="monotone"
                          dataKey="EUR"
                          stackId="1"
                          stroke="hsl(var(--chart-3))"
                          fill="hsl(var(--chart-3))"
                        />
                        <Area
                          type="monotone"
                          dataKey="USD"
                          stackId="1"
                          stroke="hsl(var(--chart-4))"
                          fill="hsl(var(--chart-4))"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Currency Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of your wallet balances
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {wallets.map((wallet) => (
                      <div key={wallet.id} className="flex items-center">
                        <div className="mr-4 rounded-full p-2 bg-primary/10">
                          <Wallet className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {wallet.currency} Wallet
                          </p>
                          <div className="h-2 w-full rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{
                                width: `${(wallet.balance / calculatePortfolioValue(wallet.currency)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="font-medium">
                          {formatCurrency(wallet.balance, wallet.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}