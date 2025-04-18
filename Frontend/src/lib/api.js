import axios from 'axios';

// Create API instance with baseURL
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,
  timeout: 10000
});

// Stock market WebSocket URL
export const STOCK_MARKET_WS_URL = process.env.NEXT_PUBLIC_STOCK_MARKET_URL || 'http://localhost:5001';

// Request interceptor for adding auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 403 (Forbidden) and we haven't retried yet
    if (error.response?.status === 403 && !originalRequest._retry && error.response?.data?.tokenExpired) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh the token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const res = await axios.post(`${api.defaults.baseURL}/auth/refresh-token`, {
          refreshToken
        });
        
        if (res.data.accessToken) {
          // Update the access token in localStorage and in the default headers
          localStorage.setItem('accessToken', res.data.accessToken);
          if (res.data.accessTokenExpiry) {
            localStorage.setItem('accessTokenExpiry', res.data.accessTokenExpiry);
          }
          
          api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Check if the refresh token is expired or invalid
        if (refreshError.response?.status === 403) {
          // Clear auth data and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          
          // Redirect to login page
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const AuthAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: (token) => api.post('/auth/logout', { token }),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (passwordData) => api.post('/auth/change-password', passwordData)
};

// Wallet API
export const WalletAPI = {
  getUserWallets: () => api.get('/wallet'),
  getMasterWallet: (currencyCode) => api.get(`/wallet/master/${currencyCode}`),
  getForeignWallets: (masterCurrency) => api.get(`/wallet/foreign/${masterCurrency}`),
  createWallet: (walletData) => api.post('/wallet', walletData),
  depositFunds: (depositData) => api.post('/wallet/deposit', depositData),
  withdrawFunds: (withdrawData) => api.post('/wallet/withdraw', withdrawData),
  exchangeCurrency: (exchangeData) => api.post('/wallet/exchange', exchangeData),
  getTotalBalance: (currencyCode) => api.get(`/wallet/balance/total${currencyCode ? `?currency=${currencyCode}` : ''}`),
  getWalletById: (id) => api.get(`/wallets/${id}`),
  transferFunds: (data) => api.post('/wallets/transfer', data)
};

// Stocks API
export const StocksAPI = {
  getAllStocks: () => api.get('/stocks'),
  
  getStockById: (stockId) => {
    console.log(`Fetching stock data for ID: ${stockId}`);
    return api.get(`/stocks/${stockId}`)
      .catch(error => {
        console.error(`Error fetching stock ${stockId}:`, error.message);
        throw error;
      });
  },
  
  getStocksByMarket: (market) => {
    console.log(`Fetching stocks for market: ${market}`);
    return api.get(`/stocks/markets/${market}`)
      .catch(error => {
        console.error(`Error fetching stocks for market ${market}:`, error.message);
        throw error;
      });
  },
  
  getUserPortfolio: () => api.get('/stocks/user/portfolio'),
  
  updateStockPrices: () => {
    console.log('Requesting stock price update');
    return api.post('/stocks/update-prices')
      .catch(error => {
        console.error('Error updating stock prices:', error.message);
        throw error;
      });
  },
  
  seedStockData: () => {
    console.log('Requesting stock data seeding');
    return api.post('/stocks/seed')
      .catch(error => {
        console.error('Error seeding stock data:', error.message);
        throw error;
      });
  },
  
  getStockHistory: (stockId, range = '1d') => {
    console.log(`Fetching price history for stock ${stockId} with range ${range}`);
    return api.get(`/stocks/${stockId}/history?range=${range}`)
      .catch(error => {
        console.error(`Error fetching stock history for ${stockId}:`, error.message);
        throw error;
      });
  }
};

// Trades API
export const TradesAPI = {
  getUserTrades: (page = 1, limit = 10) => api.get(`/trades?page=${page}&limit=${limit}`),
  getUserInvestmentValue: () => api.get('/trades/investment-value'),
  executeBuyTrade: (tradeData) => {
    console.log("Sending buy trade data:", JSON.stringify(tradeData));
    return api.post('/trades/buy', tradeData);
  },
  executeSellTrade: (tradeData) => {
    console.log("Sending sell trade data:", JSON.stringify(tradeData));
    return api.post('/trades/sell', tradeData);
  },
  getTradeById: (id) => api.get(`/trades/${id}`),
  getTradesByType: (type, page = 1, limit = 10) => api.get(`/trades/type/${type}?page=${page}&limit=${limit}`)
};

// Transactions API
export const TransactionsAPI = {
  getUserTransactions: (page = 1, limit = 10) => api.get(`/transactions?page=${page}&limit=${limit}`),
  getTransactionsByType: (type, page = 1, limit = 10) => 
    api.get(`/transactions/type/${type}?page=${page}&limit=${limit}`),
  getTransactionStats: () => api.get('/transactions/stats')
};

export default api; 