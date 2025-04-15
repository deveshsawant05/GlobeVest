"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TransactionsAPI, WalletAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpIcon, ArrowDownIcon, RefreshCwIcon } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalConversions: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [masterWallet, setMasterWallet] = useState(null);

  // Fetch transactions based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // First get master wallet to know default currency
        const walletsResponse = await WalletAPI.getUserWallets();
        const masterWallet = walletsResponse.data.find(wallet => wallet.is_master);
        setMasterWallet(masterWallet);
        
        // Then fetch transactions
        let response;
        if (activeTab === "all") {
          response = await TransactionsAPI.getUserTransactions(
            pagination.page, 
            pagination.limit
          );
        } else {
          response = await TransactionsAPI.getTransactionsByType(
            activeTab,
            pagination.page, 
            pagination.limit
          );
        }
        
        setTransactions(response.data.transactions || response.data);
        
        // Update pagination if available
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.data.pagination.total || 0,
            totalPages: response.data.pagination.totalPages || 1
          }));
        }
        
        // Fetch transaction stats
        const statsResponse = await TransactionsAPI.getTransactionStats();
        setStats(statsResponse.data);
        
      } catch (error) {
        console.error("Error fetching transactions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load transactions"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [activeTab, pagination.page, pagination.limit, toast]);

  // Handle tab change
  const handleTabChange = (value) => {
    setActiveTab(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on tab change
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || (masterWallet ? masterWallet.currency_code : "USD"),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) + " " + date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Get transaction type badge
  const getTransactionBadge = (type) => {
    switch (type) {
      case "deposit":
        return (
          <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/20 dark:text-green-400">
            <ArrowDownIcon className="mr-1 h-3 w-3" />
            Deposit
          </Badge>
        );
      case "withdrawal":
        return (
          <Badge className="bg-red-500/20 text-red-700 hover:bg-red-500/20 dark:text-red-400">
            <ArrowUpIcon className="mr-1 h-3 w-3" />
            Withdrawal
          </Badge>
        );
      case "conversion":
        return (
          <Badge className="bg-blue-500/20 text-blue-700 hover:bg-blue-500/20 dark:text-blue-400">
            <RefreshCwIcon className="mr-1 h-3 w-3" />
            Conversion
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">{type}</Badge>
        );
    }
  };

  const masterCurrency = masterWallet?.currency_code || "USD";

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage your transaction history
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Deposits</CardTitle>
              <CardDescription>Total funds added</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalDeposits || 0, masterCurrency)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Withdrawals</CardTitle>
              <CardDescription>Total funds withdrawn</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalWithdrawals || 0, masterCurrency)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Conversions</CardTitle>
              <CardDescription>Total currency exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalConversions || stats.monthlyActivity?.reduce((sum, month) => 
                  sum + (month.conversions > 0 ? 1 : 0), 0) || 0}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                View all your past transactions and their details
              </CardDescription>
            </div>
            <div className="mt-4 sm:mt-0">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="deposit">Deposits</TabsTrigger>
                  <TabsTrigger value="withdrawal">Withdrawals</TabsTrigger>
                  <TabsTrigger value="conversion">Conversions</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading transactions...</p>
                </div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-medium">No transactions found</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You don't have any {activeTab !== "all" ? activeTab : ""} transactions yet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.transaction_id}>
                        <TableCell>
                          {formatDate(transaction.created_at)}
                        </TableCell>
                        <TableCell>
                          {getTransactionBadge(transaction.transaction_type)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(transaction.amount, transaction.currency_code)}
                        </TableCell>
                        <TableCell>{transaction.currency_code}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-900/20 dark:text-green-400">
                            Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          
          {!loading && transactions.length > 0 && (
            <CardFooter className="flex justify-center border-t p-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </CardFooter>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
} 