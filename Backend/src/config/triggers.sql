-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

----------------------
-- TRANSACTION LOGGING
----------------------
-- Function to log transactions automatically
CREATE OR REPLACE FUNCTION log_wallet_transaction()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transactions (user_id, wallet_id, transaction_type, amount)
    VALUES (NEW.user_id, NEW.wallet_id, 'deposit', NEW.balance - OLD.balance);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to wallets table
CREATE TRIGGER wallet_transaction_trigger
AFTER UPDATE OF balance ON wallets
FOR EACH ROW
WHEN (NEW.balance > OLD.balance)  -- Only log deposits
EXECUTE FUNCTION log_wallet_transaction();

