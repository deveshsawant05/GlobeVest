"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Plus, Wallet } from "lucide-react";
import { WalletAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Main wallet component
export default function WalletsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [masterWallet, setMasterWallet] = useState(null);
  const [foreignWallets, setForeignWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch wallets data
  useEffect(() => {
    const fetchWallets = async () => {
      try {
        setIsLoading(true);
        
        // First, fetch all user wallets
        const allWalletsResponse = await WalletAPI.getUserWallets();
        if (!allWalletsResponse.data || allWalletsResponse.data.length === 0) {
          setWallets([]);
          setMasterWallet(null);
          setForeignWallets([]);
          return;
        }
        
        setWallets(allWalletsResponse.data);
        
        // Find the master wallet from the fetched wallets using is_master property
        const masterWalletFound = allWalletsResponse.data.find(wallet => wallet.is_master === true);
        
        if (masterWalletFound) {
          setMasterWallet(masterWalletFound);
          
          // Set foreign wallets (all non-master wallets)
          const foreignWalletsFound = allWalletsResponse.data.filter(wallet => wallet.is_master !== true);
          setForeignWallets(foreignWalletsFound);
        } else {
          // If no wallet is marked as master (shouldn't happen), try to fetch master wallet directly
          try {
            // Get the first wallet's currency as fallback
            const fallbackCurrency = allWalletsResponse.data[0].currency_code;
            const masterResponse = await WalletAPI.getMasterWallet(fallbackCurrency);
            
            if (masterResponse.data) {
              setMasterWallet(masterResponse.data);
              // Fetch foreign wallets using the master wallet's currency
              const foreignResponse = await WalletAPI.getForeignWallets(masterResponse.data.currency_code);
              setForeignWallets(foreignResponse.data);
            }
          } catch (masterError) {
            console.error("Error fetching master wallet:", masterError);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to determine master wallet",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching wallets:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load wallets data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallets();
  }, [toast, refreshTrigger]);

  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  // Trigger refresh after operations
  const refreshWallets = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Wallets</h1>
          <div className="flex gap-2">
            <AddWalletDialog onSuccess={refreshWallets} existingWallets={wallets} />
            <ExchangeDialog 
              masterWallet={masterWallet}
              foreignWallets={foreignWallets}
              onSuccess={refreshWallets}
            />
          </div>
        </div>
        
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Wallets</TabsTrigger>
            <TabsTrigger value="master">Master Wallet</TabsTrigger>
            <TabsTrigger value="foreign">Foreign Wallets</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <p>Loading wallets...</p>
              ) : wallets.length === 0 ? (
                <p>No wallets found. Create your first wallet to get started.</p>
              ) : (
                wallets.map((wallet) => (
                  <WalletCard 
                    key={wallet.wallet_id} 
                    wallet={wallet} 
                    isMaster={masterWallet?.wallet_id === wallet.wallet_id}
                    onDeposit={refreshWallets}
                  />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="master" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {isLoading ? (
                <p>Loading master wallet...</p>
              ) : !masterWallet ? (
                <p>No master wallet found.</p>
              ) : (
                <WalletCard 
                  wallet={masterWallet} 
                  isMaster={true} 
                  onDeposit={refreshWallets}
                />
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="foreign" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <p>Loading foreign wallets...</p>
              ) : foreignWallets.length === 0 ? (
                <p>No foreign wallets found. Add a foreign wallet to start trading.</p>
              ) : (
                foreignWallets.map((wallet) => (
                  <WalletCard 
                    key={wallet.wallet_id} 
                    wallet={wallet} 
                    isMaster={false}
                    onDeposit={refreshWallets}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Individual wallet card component
function WalletCard({ wallet, isMaster, onDeposit }) {
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };
  
  return (
    <Card className={isMaster ? "border-2 border-primary" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {wallet.currency_code} Wallet
            </CardTitle>
            <CardDescription>
              {isMaster ? "Master Wallet" : "Foreign Currency"}
            </CardDescription>
          </div>
          {isMaster && (
            <div className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
              Master
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formatCurrency(wallet.balance, wallet.currency_code)}
        </div>
        <p className="text-sm text-muted-foreground">
          Available Balance
        </p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        {isMaster ? (
          <div className="flex w-full space-x-2">
            <Dialog open={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">Deposit</Button>
              </DialogTrigger>
              <DialogContent>
                <DepositForm 
                  wallet={wallet} 
                  onSuccess={() => {
                    setIsDepositDialogOpen(false);
                    onDeposit();
                  }} 
                />
              </DialogContent>
            </Dialog>
            
            <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">Withdraw</Button>
              </DialogTrigger>
              <DialogContent>
                <WithdrawForm 
                  wallet={wallet} 
                  onSuccess={() => {
                    setIsWithdrawDialogOpen(false);
                    onDeposit();
                  }} 
                />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground w-full">
            Foreign wallets can only be funded through currency exchange from your master wallet.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

// Deposit funds form component
function DepositForm({ wallet, onSuccess }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleDeposit = async (e) => {
    e.preventDefault();
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than zero",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await WalletAPI.depositFunds({
        currencyCode: wallet.currency_code,
        amount: parseFloat(amount)
      });

    toast({
      title: "Deposit successful",
        description: `Successfully deposited ${amount} ${wallet.currency_code} to your wallet`,
      });
      
      onSuccess();
    } catch (error) {
      console.error("Deposit error:", error);
      toast({
        variant: "destructive",
        title: "Deposit failed",
        description: error.response?.data?.message || "Failed to deposit funds",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <DialogHeader>
        <DialogTitle>Deposit Funds</DialogTitle>
        <DialogDescription>
          Add funds to your {wallet.currency_code} wallet
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleDeposit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({wallet.currency_code})</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder={`Enter amount in ${wallet.currency_code}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Processing..." : "Deposit"}
        </Button>
      </form>
    </>
  );
}

// Withdraw funds form component
function WithdrawForm({ wallet, onSuccess }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleWithdraw = async (e) => {
    e.preventDefault();
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than zero",
      });
      return;
    }
    
    if (parseFloat(amount) > parseFloat(wallet.balance)) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `Your balance (${wallet.balance} ${wallet.currency_code}) is less than the withdrawal amount`,
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await WalletAPI.withdrawFunds({
        currencyCode: wallet.currency_code,
        amount: parseFloat(amount)
      });

      toast({
        title: "Withdrawal successful",
        description: `Successfully withdrew ${amount} ${wallet.currency_code} from your wallet`,
      });
      
      onSuccess();
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast({
        variant: "destructive",
        title: "Withdrawal failed",
        description: error.response?.data?.message || "Failed to withdraw funds",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <DialogHeader>
        <DialogTitle>Withdraw Funds</DialogTitle>
        <DialogDescription>
          Withdraw funds from your {wallet.currency_code} wallet
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleWithdraw} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="withdraw-amount">Amount ({wallet.currency_code})</Label>
          <Input
            id="withdraw-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={wallet.balance}
            placeholder={`Enter amount in ${wallet.currency_code}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Available Balance: {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: wallet.currency_code,
            }).format(wallet.balance)}
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Processing..." : "Withdraw"}
        </Button>
      </form>
    </>
  );
}

// Add wallet dialog component
function AddWalletDialog({ onSuccess, existingWallets }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Available currencies (excluding existing ones)
  const allCurrencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'INR', name: 'Indian Rupee' },
  ];
  
  const existingCurrencyCodes = existingWallets.map(w => w.currency_code);
  const availableCurrencies = allCurrencies.filter(c => !existingCurrencyCodes.includes(c.code));
  
  // Set default currency when dialog opens
  useEffect(() => {
    if (isOpen && availableCurrencies.length > 0) {
      setCurrencyCode(availableCurrencies[0].code);
    }
  }, [isOpen, availableCurrencies]);
  
  const handleAddWallet = async (e) => {
    e.preventDefault();
    
    if (!currencyCode) {
      toast({
        variant: "destructive",
        title: "Currency required",
        description: "Please select a currency for your wallet",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await WalletAPI.createWallet({
        currencyCode,
        initialBalance: 0
      });
      
      toast({
        title: "Wallet created",
        description: `Successfully created ${currencyCode} wallet`,
      });
      
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Create wallet error:", error);
      toast({
        variant: "destructive",
        title: "Failed to create wallet",
        description: error.response?.data?.message || "An error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Wallet</DialogTitle>
          <DialogDescription>
            Create a wallet for a new currency
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddWallet} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            {availableCurrencies.length > 0 ? (
              <Select 
                value={currencyCode} 
                onValueChange={setCurrencyCode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.name} ({currency.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-md border border-input bg-background text-sm text-muted-foreground">
                No more currencies available
              </div>
            )}
            {availableCurrencies.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                You already have wallets for all available currencies.
              </p>
            )}
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || availableCurrencies.length === 0 || !currencyCode}
          >
            {isLoading ? "Creating..." : "Create Wallet"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Currency exchange dialog
function ExchangeDialog({ masterWallet, foreignWallets, onSuccess }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [fromCurrency, setFromCurrency] = useState('');
  const [toCurrency, setToCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setFromCurrency(masterWallet?.currency_code || '');
      setToCurrency('');
      setAmount('');
    }
  }, [isOpen, masterWallet]);
  
  // Get available wallets for selection
  const getAvailableWallets = () => {
    const wallets = [];
    if (masterWallet) {
      wallets.push(masterWallet);
    }
    if (foreignWallets && foreignWallets.length > 0) {
      wallets.push(...foreignWallets);
    }
    return wallets;
  };
  
  // Get destination wallet options (excluding source wallet)
  const getDestinationOptions = () => {
    return getAvailableWallets().filter(w => w.currency_code !== fromCurrency);
  };
  
  // Handle exchange submission
  const handleExchange = async (e) => {
    e.preventDefault();
    
    if (!fromCurrency || !toCurrency) {
      toast({
        variant: "destructive",
        title: "Currencies required",
        description: "Please select source and destination currencies",
      });
      return;
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than zero",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await WalletAPI.exchangeCurrency({
        fromCurrency,
        toCurrency,
        amount: parseFloat(amount)
      });

    toast({
        title: "Exchange successful",
        description: `Exchanged ${response.data.fromAmount} ${response.data.fromCurrency} to ${response.data.toAmount} ${response.data.toCurrency}`,
      });
      
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Exchange error:", error);
      toast({
        variant: "destructive",
        title: "Exchange failed",
        description: error.response?.data?.message || "An error occurred during exchange",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format balance display
  const formatBalance = (wallet) => {
    if (!wallet) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: wallet.currency_code,
    }).format(wallet.balance);
  };
  
  // Find wallet by currency code
  const findWalletByCurrency = (currencyCode) => {
    if (!currencyCode) return null;
    return getAvailableWallets().find(w => w.currency_code === currencyCode);
  };
  
  const sourceWallet = findWalletByCurrency(fromCurrency);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Exchange
        </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
          <DialogTitle>Currency Exchange</DialogTitle>
                      <DialogDescription>
            Exchange currency between your wallets
                      </DialogDescription>
                    </DialogHeader>
        <form onSubmit={handleExchange} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fromCurrency">From Currency</Label>
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
                          <SelectTrigger>
                <SelectValue placeholder="Select source currency" />
                          </SelectTrigger>
                          <SelectContent>
                {getAvailableWallets().map((wallet) => (
                  <SelectItem key={wallet.wallet_id} value={wallet.currency_code}>
                    {wallet.currency_code} ({formatBalance(wallet)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
                    <Input
              id="amount"
                      type="number"
              step="0.01"
              min="0.01"
              max={sourceWallet?.balance || 0}
              placeholder={`Enter amount in ${fromCurrency}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!fromCurrency}
              required
            />
            {sourceWallet && (
              <p className="text-xs text-muted-foreground">
                Available: {formatBalance(sourceWallet)}
              </p>
            )}
                  </div>
          
          <div className="space-y-2">
            <Label htmlFor="toCurrency">To Currency</Label>
                    <Select 
              value={toCurrency} 
              onValueChange={setToCurrency}
              disabled={!fromCurrency}
                    >
                      <SelectTrigger>
                <SelectValue placeholder="Select destination currency" />
                      </SelectTrigger>
                      <SelectContent>
                {getDestinationOptions().map((wallet) => (
                  <SelectItem key={wallet.wallet_id} value={wallet.currency_code}>
                    {wallet.currency_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !fromCurrency || !toCurrency || !amount}
          >
            {isLoading ? "Processing..." : "Exchange Currency"}
                    </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}