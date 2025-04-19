const walletQueries = {
    // Get all wallets for a user
    GET_USER_WALLETS: `
        SELECT wallet_id, user_id, currency_code, balance, created_at, is_master
        FROM wallets
        WHERE user_id = $1
        ORDER BY is_master DESC, created_at ASC
    `,

    // Get user's master wallet (country currency)
    GET_MASTER_WALLET: `
        SELECT wallet_id, user_id, currency_code, balance, created_at, is_master
        FROM wallets
        WHERE user_id = $1 AND is_master = true
        LIMIT 1
    `,

    // Get all foreign currency wallets
    GET_FOREIGN_WALLETS: `
        SELECT wallet_id, user_id, currency_code, balance, created_at, is_master
        FROM wallets
        WHERE user_id = $1 AND is_master = false
        ORDER BY created_at ASC
    `,

    // Deposit funds into wallet
    DEPOSIT_FUNDS: `
        UPDATE wallets
        SET balance = balance + $2
        WHERE currency_code = $1 AND user_id = $3 AND is_master = true
        RETURNING wallet_id, balance
    `,

    // Withdraw funds from wallet
    WITHDRAW_FUNDS: `
        UPDATE wallets
        SET balance = balance - $2
        WHERE currency_code = $1 AND user_id = $3 AND balance >= $2
        RETURNING wallet_id, balance
    `,

    // Create wallet entry
    CREATE_WALLET: `
        INSERT INTO wallets (user_id, currency_code, balance, is_master)
        VALUES ($1, $2, $3, $4)
        RETURNING wallet_id, user_id, currency_code, balance, created_at, is_master
    `,

    // Check if wallet exists
    CHECK_WALLET_EXISTS: `
        SELECT COUNT(*) FROM wallets
        WHERE user_id = $1 AND currency_code = $2
    `,

    // Get total wallet value across all currencies (for dashboard)
    GET_TOTAL_WALLET_VALUE: `
        WITH wallet_values AS (
            SELECT 
                w.wallet_id,
                w.currency_code,
                w.balance,
                CASE 
                    WHEN w.currency_code = $2 THEN w.balance 
                    WHEN er.rate IS NOT NULL THEN w.balance * er.rate 
                    ELSE w.balance -- fallback if no exchange rate exists
                END as converted_balance
            FROM wallets w
            LEFT JOIN exchange_rates er ON w.currency_code = er.from_currency AND er.to_currency = $2
            WHERE w.user_id = $1
        )
        SELECT 
            COALESCE(SUM(converted_balance), 0) as total_balance
        FROM wallet_values
    `,

    // Get wallet by currency
    GET_WALLET_BY_CURRENCY: `
        SELECT wallet_id, balance, is_master
        FROM wallets
        WHERE user_id = $1 AND currency_code = $2
    `,
    
    // Get exchange rate between two currencies
    GET_EXCHANGE_RATE: `
        SELECT rate
        FROM exchange_rates
        WHERE from_currency = $1 AND to_currency = $2
    `,

    // Get all exchange rates
    GET_ALL_EXCHANGE_RATES: `
        SELECT from_currency, to_currency, rate
        FROM exchange_rates
    `,

    // Get wallet by ID
    GET_WALLET_BY_ID: `
        SELECT wallet_id, user_id, currency_code, balance, is_master
        FROM wallets
        WHERE wallet_id = $1
    `,

    // Check wallet balance
    CHECK_WALLET_BALANCE: `
        SELECT balance
        FROM wallets
        WHERE user_id = $1 AND currency_code = $2
    `
};

module.exports = walletQueries;
