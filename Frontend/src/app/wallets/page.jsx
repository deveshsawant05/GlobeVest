"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, wallets, exchangeRates } from "@/lib/data";
import { ArrowDownUp, ArrowRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function WalletsPage() {
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("USD");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState("USD");
  const [convertFromCurrency, setConvertFromCurrency] = useState("USD");
  const [convertToCurrency, setConvertToCurrency] = useState("EUR");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertedAmount, setConvertedAmount] = useState(null);

  const handleDeposit = () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid deposit amount.",
      });
      return;
    }

    toast({
      title: "Deposit successful",
      description: `${formatCurrency(Number(depositAmount), depositCurrency)} has been added to your ${depositCurrency} wallet.`,
    });
    
    setDepositAmount("");
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid withdrawal amount.",
      });
      return;
    }

    const wallet = wallets.find(w => w.currency === withdrawCurrency);
    if (!wallet || wallet.balance < Number(withdrawAmount)) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `You don't have enough ${withdrawCurrency} in your wallet.`,
      });
      return;
    }

    toast({
      title: "Withdrawal initiated",
      description: `${formatCurrency(Number(withdrawAmount), withdrawCurrency)} will be sent to your bank account.`,
    });
    
    setWithdrawAmount("");
  };

  const calculateConversion = () => {
    if (!convertAmount || isNaN(Number(convertAmount)) || Number(convertAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount to convert.",
      });
      return;
    }

    const wallet = wallets.find(w => w.currency === convertFromCurrency);
    if (!wallet || wallet.balance < Number(convertAmount)) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `You don't have enough ${convertFromCurrency} in your wallet.`,
      });
      return;
    }

    const rate = exchangeRates[convertFromCurrency][convertToCurrency];
    const result = Number(convertAmount) * rate;
    setConvertedAmount(result);
  };

  const handleConvert = () => {
    if (convertedAmount === null) {
      return;
    }

    toast({
      title: "Conversion successful",
      description: `${formatCurrency(Number(convertAmount), convertFromCurrency)} has been converted to ${formatCurrency(convertedAmount, convertToCurrency)}.`,
    });
    
    setConvertAmount("");
    setConvertedAmount(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Wallets</h1>
        <p className="text-muted-foreground">
          Manage your multi-currency wallets, make deposits, withdrawals, and conversions.
        </p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <Card key={wallet.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">
                  {wallet.currency} Wallet
                </CardTitle>
                <WalletIcon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatCurrency(wallet.balance, wallet.currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(wallet.lastUpdated).toLocaleString()}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Deposit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Deposit to {wallet.currency} Wallet</DialogTitle>
                      <DialogDescription>
                        Add funds to your {wallet.currency} wallet from your bank account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="deposit-amount">Amount</Label>
                        <Input
                          id="deposit-amount"
                          type="number"
                          placeholder="Enter amount"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="deposit-method">Payment Method</Label>
                        <Select defaultValue="bank">
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank">Bank Transfer</SelectItem>
                            <SelectItem value="card">Credit/Debit Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleDeposit}>Deposit Funds</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Withdraw</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Withdraw from {wallet.currency} Wallet</DialogTitle>
                      <DialogDescription>
                        Withdraw funds from your {wallet.currency} wallet to your bank account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="withdraw-amount">Amount</Label>
                        <Input
                          id="withdraw-amount"
                          type="number"
                          placeholder="Enter amount"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="withdraw-destination">Destination</Label>
                        <Select defaultValue="bank">
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank">Bank Account</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleWithdraw}>Withdraw Funds</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
          
          <Card className="flex flex-col items-center justify-center p-6">
            <Plus className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold mb-2">Add New Wallet</h3>
            <p className="text-center text-muted-foreground mb-4">
              Create a new currency wallet to diversify your portfolio
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Wallet
            </Button>
          </Card>
        </div>
        
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Currency Operations</h2>
          
          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              <TabsTrigger value="convert">Convert</TabsTrigger>
            </TabsList>
            <TabsContent value="deposit" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Funds</CardTitle>
                  <CardDescription>
                    Add money to your GlobeVest wallets from external sources.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="deposit-currency">Select Wallet</Label>
                    <Select 
                      value={depositCurrency} 
                      onValueChange={(value) => setDepositCurrency(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.currency}>
                            {wallet.currency} Wallet
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deposit-amount-main">Amount</Label>
                    <Input
                      id="deposit-amount-main"
                      type="number"
                      placeholder="Enter amount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deposit-method-main">Payment Method</Label>
                    <Select defaultValue="bank">
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="card">Credit/Debit Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleDeposit} className="w-full">Deposit Funds</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="withdraw" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>
                    Transfer money from your GlobeVest wallets to your bank account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="withdraw-currency">Select Wallet</Label>
                    <Select 
                      value={withdrawCurrency} 
                      onValueChange={(value) => setWithdrawCurrency(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.currency}>
                            {wallet.currency} Wallet ({formatCurrency(wallet.balance, wallet.currency)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="withdraw-amount-main">Amount</Label>
                    <Input
                      id="withdraw-amount-main"
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="withdraw-destination-main">Destination</Label>
                    <Select defaultValue="bank">
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleWithdraw} className="w-full">Withdraw Funds</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="convert" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Convert Currency</CardTitle>
                  <CardDescription>
                    Exchange funds between your different currency wallets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-5 gap-4 items-end">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="convert-from">From</Label>
                      <Select 
                        value={convertFromCurrency} 
                        onValueChange={(value) => setConvertFromCurrency(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {wallets.map((wallet) => (
                            <SelectItem key={wallet.id} value={wallet.currency}>
                              {wallet.currency} ({formatCurrency(wallet.balance, wallet.currency)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-center items-center">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="convert-to">To</Label>
                      <Select 
                        value={convertToCurrency} 
                        onValueChange={(value) => setConvertToCurrency(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {wallets.map((wallet) => (
                            <SelectItem key={wallet.id} value={wallet.currency}>
                              {wallet.currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="convert-amount">Amount to Convert</Label>
                    <Input
                      id="convert-amount"
                      type="number"
                      placeholder="Enter amount"
                      value={convertAmount}
                      onChange={(e) => {
                        setConvertAmount(e.target.value);
                        setConvertedAmount(null);
                      }}
                    />
                  </div>
                  
                  {convertedAmount !== null && (
                    <div className="p-4 rounded-md bg-muted">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-muted-foreground">You'll receive approximately:</p>
                          <p className="text-lg font-bold">{formatCurrency(convertedAmount, convertToCurrency)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Exchange Rate:</p>
                          <p className="text-sm">
                            1 {convertFromCurrency} = {exchangeRates[convertFromCurrency][convertToCurrency]} {convertToCurrency}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  {convertedAmount === null ? (
                    <Button onClick={calculateConversion} className="w-full">
                      Calculate Conversion
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setConvertedAmount(null)} className="w-1/2">
                        Cancel
                      </Button>
                      <Button onClick={handleConvert} className="w-1/2">
                        Confirm Conversion
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}