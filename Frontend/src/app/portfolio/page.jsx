"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { StocksAPI, WalletAPI } from "@/lib/api";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowDownIcon, ArrowUpIcon, PieChartIcon, TrendingUpIcon, DollarSign } from "lucide-react";

// Color scheme for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
    sectorDistribution: []
  });
  const [wallets, setWallets] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        setIsLoading(true);
        // Fetch user's portfolio of stocks
        const portfolioResponse = await StocksAPI.getUserPortfolio();
        
        // Fetch user's wallets
        const walletsResponse = await WalletAPI.getUserWallets();
        
        if (portfolioResponse.data && walletsResponse.data) {
          const stocksData = portfolioResponse.data.stocks || [];
          const totalInvestment = portfolioResponse.data.totalInvestment || 0;
          const totalCurrentValue = portfolioResponse.data.totalCurrentValue || 0;
          const profitLoss = totalCurrentValue - totalInvestment;
          const profitLossPercentage = totalInvestment > 0 
            ? (profitLoss / totalInvestment) * 100 
            : 0;
          
          // Calculate market distribution
          const marketGroups = {};
          stocksData.forEach(stock => {
            if (!marketGroups[stock.market]) {
              marketGroups[stock.market] = 0;
            }
            marketGroups[stock.market] += parseFloat(stock.current_value);
          });
          
          const marketDistribution = Object.keys(marketGroups).map(market => ({
            name: market,
            value: marketGroups[market]
          }));
          
          // For demonstration, we'll create a mock sector distribution
          // In a real app, you would get this data from your API
          const sectorDistribution = [
            { name: "Technology", value: 35 },
            { name: "Finance", value: 25 },
            { name: "Healthcare", value: 15 },
            { name: "Consumer", value: 10 },
            { name: "Energy", value: 10 },
            { name: "Other", value: 5 }
          ];
          
          setPortfolio({
            stocks: stocksData,
            totalInvestment,
            totalCurrentValue,
            profitLoss,
            profitLossPercentage,
            marketDistribution,
            sectorDistribution
          });
          
          setWallets(walletsResponse.data);
          
          // Set default currency from master wallet if available
          const masterWallet = walletsResponse.data.find(w => w.is_master);
          if (masterWallet) {
            setSelectedCurrency(masterWallet.currency_code);
          }
        }
      } catch (err) {
        console.error("Error fetching portfolio data:", err);
        setError("Failed to load portfolio data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPortfolioData();
  }, []);

  // Format percentages
  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Overview of your investment portfolio and asset allocation
        </p>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <p>Loading portfolio data...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-500">{error}</p>
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
                    {portfolio.stocks.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Different stocks in portfolio
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
                  <CardTitle>Sector Allocation</CardTitle>
                  <CardDescription>
                    Distribution across industry sectors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {portfolio.sectorDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={portfolio.sectorDistribution}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs text-muted-foreground" />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            className="text-xs text-muted-foreground"
                            width={80}
                          />
                          <Tooltip formatter={(value) => `${value}%`} />
                          <Bar dataKey="value" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No sector data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Stocks List */}
            <Card>
              <CardHeader>
                <CardTitle>Asset Holdings</CardTitle>
                <CardDescription>
                  Detailed list of all your investments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {portfolio.stocks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left font-medium">Symbol</th>
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Market</th>
                          <th className="px-4 py-2 text-right font-medium">Quantity</th>
                          <th className="px-4 py-2 text-right font-medium">Avg. Buy Price</th>
                          <th className="px-4 py-2 text-right font-medium">Current Price</th>
                          <th className="px-4 py-2 text-right font-medium">Current Value</th>
                          <th className="px-4 py-2 text-right font-medium">Profit/Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.stocks.map((stock) => {
                          const profitLoss = stock.current_value - stock.investment;
                          const profitLossPercentage = stock.investment > 0 
                            ? (profitLoss / stock.investment) * 100 
                            : 0;
                            
                          return (
                            <tr key={stock.stock_id} className="border-b">
                              <td className="px-4 py-3 font-medium">{stock.symbol}</td>
                              <td className="px-4 py-3">{stock.name}</td>
                              <td className="px-4 py-3">{stock.market}</td>
                              <td className="px-4 py-3 text-right">{stock.quantity}</td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(stock.avg_buy_price, stock.currency_code)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(stock.last_price, stock.currency_code)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(stock.current_value, stock.currency_code)}
                              </td>
                              <td className={`px-4 py-3 text-right ${
                                profitLoss >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {formatCurrency(profitLoss, stock.currency_code)}
                                <br />
                                <span className="text-xs">
                                  {formatPercentage(profitLossPercentage)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">You don't have any stocks in your portfolio yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
} 