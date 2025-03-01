// Mock data for the application

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY"];

// Mock wallets data
const wallets = [
  { id: "wallet-1", currency: "USD", balance: 5280.42, lastUpdated: "2025-04-15T10:30:00Z" },
  { id: "wallet-2", currency: "EUR", balance: 3750.18, lastUpdated: "2025-04-15T10:30:00Z" },
  { id: "wallet-3", currency: "GBP", balance: 2100.55, lastUpdated: "2025-04-15T10:30:00Z" },
  { id: "wallet-4", currency: "JPY", balance: 158000.0, lastUpdated: "2025-04-15T10:30:00Z" },
];

// Mock transactions data
const transactions = [
  { id: "tx-1", type: "deposit", amount: 1000, currency: "USD", date: "2025-04-15T08:30:00Z", status: "completed", description: "Bank transfer deposit" },
  { id: "tx-2", type: "trade", amount: 520.75, currency: "USD", date: "2025-04-14T15:45:00Z", status: "completed", description: "Purchased 5 AAPL shares" },
  { id: "tx-3", type: "withdrawal", amount: 300, currency: "EUR", date: "2025-04-13T12:15:00Z", status: "completed", description: "Withdrawal to bank account" },
];

// Mock stocks data
const stocks = [
  { id: "stock-1", symbol: "AAPL", name: "Apple Inc.", price: 182.52, change: 1.25, changePercent: 0.69, market: "NASDAQ", currency: "USD" },
  { id: "stock-2", symbol: "MSFT", name: "Microsoft Corporation", price: 417.88, change: 2.36, changePercent: 0.57, market: "NASDAQ", currency: "USD" },
];

// Generate stock history data for charts
const getStockHistory = (stockId) => {
  const history = [];
  const stock = stocks.find((s) => s.id === stockId);
  if (!stock) return [];
  const basePrice = stock.price * 0.9;
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const randomFactor = 1 + (Math.random() * 0.1 - 0.05);
    const dayPrice = i === 0 ? stock.price : history.length > 0 ? history[history.length - 1].price * randomFactor : basePrice * randomFactor;
    history.push({ date: date.toISOString().split("T")[0], price: parseFloat(dayPrice.toFixed(2)) });
  }
  return history;
};

// Exchange rates for currency conversion
const exchangeRates = {
  USD: { USD: 1, EUR: 0.92, GBP: 0.78, JPY: 153.25, CNY: 7.23 },
  EUR: { USD: 1.09, EUR: 1, GBP: 0.85, JPY: 166.58, CNY: 7.86 },
};

// Calculate total portfolio value in a specific currency
const calculatePortfolioValue = (targetCurrency = "USD") => {
  return wallets.reduce((total, wallet) => {
    const conversionRate = exchangeRates[wallet.currency]?.[targetCurrency] || 1;
    return total + wallet.balance * conversionRate;
  }, 0);
};

// Format currency based on locale
const formatCurrency = (amount, currency) => {
  const currencyMap = {
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    JPY: "ja-JP",
    CNY: "zh-CN",
  };
  return new Intl.NumberFormat(currencyMap[currency], { style: "currency", currency }).format(amount);
};

export { wallets, transactions, stocks, getStockHistory, exchangeRates, calculatePortfolioValue, formatCurrency };
