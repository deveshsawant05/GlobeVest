import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StockInfo({ stock }) {
  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>About {stock.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              {stock.name} ({stock.symbol}) is a publicly traded company on the {stock.market} market. 
              The stock is traded in {stock.currency_code} and is available for international investors.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium">Market</h4>
                <p className="text-sm text-muted-foreground">{stock.market}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Currency</h4>
                <p className="text-sm text-muted-foreground">{stock.currency_code}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Current Price</h4>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(stock.last_price, stock.currency_code)}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Day Range</h4>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(stock.day_low || stock.last_price * 0.98, stock.currency_code)} - {formatCurrency(stock.day_high || stock.last_price * 1.02, stock.currency_code)}
                </p>
              </div>
              {stock.volume && (
                <div>
                  <h4 className="text-sm font-medium">Volume</h4>
                  <p className="text-sm text-muted-foreground">
                    {stock.volume.toLocaleString()}
                  </p>
                </div>
              )}
              {stock.market_cap && (
                <div>
                  <h4 className="text-sm font-medium">Market Cap</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(stock.market_cap, stock.currency_code)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Market Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Trading Hours</h4>
              <p className="text-sm text-muted-foreground">
                {stock.market === "NASDAQ" || stock.market === "NYSE" ? "9:30 AM - 4:00 PM ET" : 
                stock.market === "Nikkei" ? "9:00 AM - 3:00 PM JST" :
                stock.market === "FTSE" ? "8:00 AM - 4:30 PM GMT" :
                stock.market === "DAX" ? "9:00 AM - 5:30 PM CET" :
                "9:15 AM - 3:30 PM IST"}
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Exchange Fees</h4>
              <p className="text-sm text-muted-foreground">
                0.1% per transaction
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tax Information</h4>
              <p className="text-sm text-muted-foreground">
                Profits may be subject to local and international taxes. Please consult a tax professional.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}