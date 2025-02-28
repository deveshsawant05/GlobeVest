CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Authentication Tokens
CREATE TABLE IF NOT EXISTS tokens (
    token_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT UNIQUE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('access', 'refresh')),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Wallets: Handles different currency balances
CREATE TABLE IF NOT EXISTS wallets (
    wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    currency_code CHAR(3) NOT NULL,  -- ISO 4217 currency code (e.g., USD, EUR)
    balance DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (user_id, currency_code)  -- Ensures one wallet per currency per user
);

-- Transactions: Logs all deposits, withdrawals, and conversions
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    wallet_id UUID NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'conversion')),
    amount DECIMAL(18, 4) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE
);

-- Stocks: Stores stock details
CREATE TABLE IF NOT EXISTS stocks (
    stock_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(10) UNIQUE NOT NULL,  -- E.g., AAPL, TSLA
    name VARCHAR(100) NOT NULL,
    market VARCHAR(50) NOT NULL,  -- E.g., NASDAQ, NYSE
    currency_code CHAR(3) NOT NULL,  -- Trading currency
    last_price DECIMAL(18, 4) NOT NULL CHECK (last_price >= 0),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trades: Stores user stock trades
CREATE TABLE IF NOT EXISTS trades (
    trade_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    wallet_id UUID NOT NULL,  -- Wallet used for trade
    stock_id UUID NOT NULL,
    trade_type VARCHAR(10) NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(18, 4) NOT NULL CHECK (price > 0),
    total_amount DECIMAL(18, 4) NOT NULL CHECK (total_amount > 0),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE
);
