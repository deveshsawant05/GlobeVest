import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp } from "lucide-react";
import { TradesAPI } from "@/lib/api";

export default function TradeForm({ stock, wallets, onTradeComplete }) {
  const { toast } = useToast();
  
  // State variables
  const [selectedWallet, setSelectedWallet] = useState("");
  const [quantity, setQuantity] = useState("");
  const [tradeType, setTradeType] = useState("buy");
  const [dataLoading, setDataLoading] = useState(false);
  
  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Set default wallet when wallets change or component mounts
  useEffect(() => {
    if (wallets && wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0].wallet_id.toString());
    }
  }, [wallets, selectedWallet]);
  
  // Calculate total cost/proceeds
  const calculateTotal = () => {
    if (!stock || !quantity || isNaN(parseFloat(quantity))) {
      return 0;
    }
    
    return parseFloat(quantity) * stock.last_price;
  };
  
  // Execute trade
  const executeTrade = async () => {
    if (!stock || !selectedWallet || !quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please enter a valid quantity and select a wallet",
      });
      return;
    }
    
    const total = calculateTotal();
    
    // If buying, check if wallet has enough funds
    if (tradeType === "buy") {
      const wallet = wallets.find(w => w.wallet_id.toString() === selectedWallet);
      if (!wallet || parseFloat(wallet.balance) < total) {
        toast({
          variant: "destructive",
          title: "Insufficient Funds",
          description: `You need ${formatCurrency(total, stock.currency_code)} but only have ${formatCurrency(wallet.balance, stock.currency_code)}`,
        });
        return;
      }
    }
    
    setDataLoading(true);
    
    try {
      // Find the actual wallet object for better data access
      const wallet = wallets.find(w => w.wallet_id.toString() === selectedWallet);
      
      if (!wallet) {
        throw new Error("Selected wallet not found");
      }
      
      // Prepare trade data ensuring all fields are present and properly formatted
      const tradeData = {
        stockId: stock.stock_id,
        walletId: wallet.wallet_id,
        quantity: parseFloat(quantity)
      };
      
      console.log("Executing trade with data:", JSON.stringify(tradeData));
      
      if (tradeType === "buy") {
        await TradesAPI.executeBuyTrade(tradeData);
        toast({
          title: "Buy Order Executed",
          description: `Successfully purchased ${quantity} shares of ${stock.symbol}`,
        });
      } else {
        await TradesAPI.executeSellTrade(tradeData);
        toast({
          title: "Sell Order Executed",
          description: `Successfully sold ${quantity} shares of ${stock.symbol}`,
        });
      }
      
      // Clear form
      setQuantity("");
      
      // Notify parent component to refresh wallet data
      if (onTradeComplete) {
        onTradeComplete();
      }
    } catch (error) {
      console.error("Trade execution error:", error);
      console.error("Error response data:", error.response?.data);
      
      // Provide more detailed error message to user
      let errorMessage = "Failed to execute trade";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Trade Failed",
        description: errorMessage
      });
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade {stock.symbol}</CardTitle>
        <CardDescription>
          Current price: {formatCurrency(stock.last_price, stock.currency_code)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buy" value={tradeType} onValueChange={setTradeType} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="gap-2">
              <ArrowDown className="h-4 w-4 text-green-500" />
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="gap-2">
              <ArrowUp className="h-4 w-4 text-red-500" />
              Sell
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="buy" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet ({stock.currency_code})</Label>
              <Select
                value={selectedWallet}
                onValueChange={setSelectedWallet}
                disabled={wallets.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.wallet_id} value={wallet.wallet_id.toString()}>
                      {wallet.currency_code} ({formatCurrency(wallet.balance, wallet.currency_code)})
                    </SelectItem>
                  ))}
                  {wallets.length === 0 && (
                    <SelectItem value="no-wallet" disabled>
                      No {stock.currency_code} wallet available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {wallets.length === 0 && (
                <p className="text-xs text-destructive">
                  You need a {stock.currency_code} wallet to trade this stock.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter number of shares"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-sm">
                <span>Estimated Cost:</span>
                <span className="font-bold">
                  {formatCurrency(calculateTotal(), stock.currency_code)}
                </span>
              </div>
              
              <Button
                className="w-full mt-4"
                onClick={executeTrade}
                disabled={
                  dataLoading || 
                  wallets.length === 0 || 
                  !quantity || 
                  isNaN(parseFloat(quantity)) || 
                  parseFloat(quantity) <= 0
                }
              >
                {dataLoading ? "Processing..." : "Buy Stock"}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="sell" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet ({stock.currency_code})</Label>
              <Select
                value={selectedWallet}
                onValueChange={setSelectedWallet}
                disabled={wallets.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.wallet_id} value={wallet.wallet_id.toString()}>
                      {wallet.currency_code} ({formatCurrency(wallet.balance, wallet.currency_code)})
                    </SelectItem>
                  ))}
                  {wallets.length === 0 && (
                    <SelectItem value="no-wallet" disabled>
                      No {stock.currency_code} wallet available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter number of shares"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-sm">
                <span>Estimated Proceeds:</span>
                <span className="font-bold">
                  {formatCurrency(calculateTotal(), stock.currency_code)}
                </span>
              </div>
              
              <Button
                className="w-full mt-4"
                onClick={executeTrade}
                disabled={
                  dataLoading || 
                  wallets.length === 0 || 
                  !quantity || 
                  isNaN(parseFloat(quantity)) || 
                  parseFloat(quantity) <= 0
                }
              >
                {dataLoading ? "Processing..." : "Sell Stock"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}