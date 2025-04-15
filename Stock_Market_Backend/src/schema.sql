-- Create database if it doesn't exist (run this separately in psql)
-- CREATE DATABASE globevest;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stocks table with all needed fields
CREATE TABLE IF NOT EXISTS stocks (
    stock_id UUID PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    market VARCHAR(50) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    last_price DECIMAL(18, 4) NOT NULL,
    change_value DECIMAL(18, 4), -- Changed from change_amount
    change_percent DECIMAL(8, 4), -- Changed from change_percentage
    volume BIGINT,
    previous_close DECIMAL(18, 4),
    market_cap DECIMAL(22, 4),
    day_high DECIMAL(18, 4),
    day_low DECIMAL(18, 4),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, market)
);

-- Markets reference table for 3NF
CREATE TABLE IF NOT EXISTS markets (
    market_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    country VARCHAR(50) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Currencies reference table for 3NF
CREATE TABLE IF NOT EXISTS currencies (
    currency_code CHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(5) NOT NULL
);

-- Price history table to track stock prices over time
CREATE TABLE IF NOT EXISTS stock_price_history (
    history_id SERIAL PRIMARY KEY,
    stock_id UUID NOT NULL,
    price DECIMAL(18, 4) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE
);

-- User wallets table (similar to main app)
CREATE TABLE IF NOT EXISTS wallets (
    wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    currency_code CHAR(3) NOT NULL,
    balance DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT NOW(),
    is_master BOOLEAN DEFAULT FALSE,
    UNIQUE (user_id, currency_code)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market);
CREATE INDEX IF NOT EXISTS idx_stock_price_history_stock_id ON stock_price_history(stock_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets(currency_code);
CREATE INDEX IF NOT EXISTS idx_stock_price_history_timestamp ON stock_price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_stock_price_history_stock_timestamp ON stock_price_history(stock_id, timestamp); 