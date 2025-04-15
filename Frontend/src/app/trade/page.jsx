"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowDown, ArrowUp, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { TradesAPI, StocksAPI } from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TradesPage() {
  const { toast } = useToast();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [tradeType, setTradeType] = useState("all");
  const [investmentValue, setInvestmentValue] = useState(0);

  // Fetch user trades with pagination
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setLoading(true);
        let response;
        
        if (tradeType === "all") {
          response = await TradesAPI.getUserTrades(pagination.page, pagination.limit);
        } else {
          response = await TradesAPI.getTradesByType(tradeType, pagination.page, pagination.limit);
        }
        
        setTrades(response.data.trades);
        setPagination(response.data.pagination);
        
        // Also fetch investment value
        const investmentResponse = await TradesAPI.getUserInvestmentValue();
        setInvestmentValue(investmentResponse.data.totalValue || 0);
      } catch (error) {
        console.error("Error fetching trades:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load trade history",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
  }, [pagination.page, pagination.limit, tradeType, toast]);

  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.pages) {
      setPagination({ ...pagination, page: newPage });
    }
  };

  // Handle trade type filter change
  const handleTradeTypeChange = (value) => {
    setTradeType(value);
    setPagination({ ...pagination, page: 1 }); // Reset to first page on filter change
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Trade History</h1>
          <Link href="/markets">
            <Button>Find Stocks to Trade</Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Portfolio Value Card */}
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xl">Portfolio Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "Loading..." : formatCurrency(investmentValue, "USD")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current value of all your stock holdings
              </p>
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Trade Statistics</CardTitle>
              <CardDescription>
                Summary of your trading activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Trades</p>
                  <p className="text-2xl font-bold">{pagination.total || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Buy Orders</p>
                  <p className="text-2xl font-bold text-green-600">
                    {trades.filter(trade => trade.trade_type === 'buy').length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Sell Orders</p>
                  <p className="text-2xl font-bold text-red-600">
                    {trades.filter(trade => trade.trade_type === 'sell').length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Markets</p>
                  <p className="text-2xl font-bold">
                    {new Set(trades.map(trade => trade.market)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Trade History</CardTitle>
              <Tabs 
                value={tradeType} 
                onValueChange={handleTradeTypeChange}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="buy">Buy</TabsTrigger>
                  <TabsTrigger value="sell">Sell</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : trades.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No trades found</AlertTitle>
                <AlertDescription>
                  {tradeType === "all" 
                    ? "You haven't made any trades yet. Visit the Markets page to start trading."
                    : `You haven't made any ${tradeType} trades yet.`}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 font-medium">
                          <th className="px-4 py-3 text-left">Symbol</th>
                          <th className="px-4 py-3 text-left">Type</th>
                          <th className="px-4 py-3 text-left">Quantity</th>
                          <th className="px-4 py-3 text-right">Price</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-right">Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((trade) => (
                          <tr key={trade.trade_id} className="border-b">
                            <td className="px-4 py-3">
                              <div className="font-medium">{trade.symbol}</div>
                              <div className="text-xs text-muted-foreground">{trade.market}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge 
                                variant={trade.trade_type === "buy" ? "outline" : "destructive"}
                                className="flex items-center gap-1"
                              >
                                {trade.trade_type === "buy" ? (
                                  <ArrowDown className="h-3 w-3 text-green-600" />
                                ) : (
                                  <ArrowUp className="h-3 w-3" />
                                )}
                                {trade.trade_type === "buy" ? "Buy" : "Sell"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {trade.quantity}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(trade.price, trade.currency_code)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatCurrency(trade.total_amount, trade.currency_code)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs">{formatDate(trade.created_at)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/trade/${trade.stock_id}`}>
                                <Button variant="outline" size="sm">
                                  Trade Again
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Showing {(pagination.page - 1) * pagination.limit + 1}-
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.pages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
} 