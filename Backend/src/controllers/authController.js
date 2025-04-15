const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../config/db");
const authQueries = require("../queries/authQueries");
const walletQueries = require("../queries/walletQueries");
const logger = require("../utils/logger");

// Generate secure random tokens
const generateToken = () => crypto.randomBytes(40).toString("hex");

// Calculate token expiry times
const calculateTokenExpiry = (tokenType) => {
  const now = new Date();
  if (tokenType === 'access') {
    // 15 minutes expiry for access token
    return new Date(now.getTime() + 15 * 60 * 1000);
  } else if (tokenType === 'refresh') {
    // 6 days expiry for refresh token
    return new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  }
  return now;
};

// **REGISTER**
const register = async (req, res) => {
  const { name, email, password, baseCurrency = 'USD' } = req.body;

  if (!name || !email || !password) {
    logger.warn('Registration attempt with missing fields');
    return res.status(400).json({ message: "All fields are required" });
  }

  // Start a database transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    logger.info(`Starting registration process for ${email}`);
    
    // Check if user already exists
    const existingUser = await client.query(authQueries.FIND_USER_BY_EMAIL, [email]);
    if (existingUser.rows.length > 0) {
      logger.warn(`Registration attempt with existing email: ${email}`);
      return res.status(400).json({ message: "Email already in use" });
    }
    
    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    logger.debug('Password hashed successfully');
    
    const newUser = await client.query(authQueries.REGISTER_USER, [name, email, hashedPassword]);
    const userId = newUser.rows[0].user_id;
    logger.debug(`User created with ID: ${userId}`);
    
    // Create base currency wallet (master wallet)
    await client.query(
      walletQueries.CREATE_WALLET,
      [userId, baseCurrency, 10000] // Starting with 10,000 in base currency for demo
    );
    logger.debug(`Created master wallet with currency: ${baseCurrency}`);
    
    // Create a couple of foreign currency wallets for demo
    const additionalCurrencies = ['EUR', 'JPY', 'GBP'].filter(curr => curr !== baseCurrency);
    for (const currency of additionalCurrencies.slice(0, 2)) {
      await client.query(
        walletQueries.CREATE_WALLET,
        [userId, currency, 0] // Start with zero balance in foreign currencies
      );
      logger.debug(`Created additional wallet with currency: ${currency}`);
    }
    
    await client.query('COMMIT');
    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({ 
      message: "User registered successfully",
      user: {
        user_id: newUser.rows[0].user_id,
        name: newUser.rows[0].name,
        email: newUser.rows[0].email
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error registering user: ${error.message}`);
    res.status(500).json({ message: "Error registering user" });
  } finally {
    client.release();
  }
};

// **LOGIN**
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    logger.warn('Login attempt with missing fields');
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    logger.info(`Login attempt for: ${email}`);
    const user = await pool.query(authQueries.FIND_USER_BY_EMAIL, [email]);
    
    if (user.rows.length === 0) {
      logger.warn(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    
    if (!validPassword) {
      logger.warn(`Login attempt with incorrect password for: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate tokens
    const accessToken = generateToken();
    const refreshToken = generateToken();
    logger.debug(`Generated new tokens for user: ${user.rows[0].user_id}`);

    // Set expiry times
    const accessTokenExpiry = calculateTokenExpiry('access');
    const refreshTokenExpiry = calculateTokenExpiry('refresh');

    // Update query to include expiry times
    await pool.query(
      'INSERT INTO tokens (user_id, token, type, expires_at) VALUES ($1, $2, $3, $4), ($1, $5, $6, $7)',
      [
        user.rows[0].user_id, 
        accessToken, 
        'access',
        accessTokenExpiry,
        refreshToken,
        'refresh',
        refreshTokenExpiry
      ]
    );
    
    logger.info(`User logged in successfully: ${email}`);

    res.json({ 
      accessToken, 
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
      user: {
        user_id: user.rows[0].user_id,
        name: user.rows[0].name,
        email: user.rows[0].email
      }
    });
  } catch (error) {
    logger.error(`Error during login: ${error.message}`);
    res.status(500).json({ message: "Error logging in" });
  }
};

// **LOGOUT**
const logout = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    logger.warn('Logout attempt without token');
    return res.status(400).json({ message: "Token required" });
  }

  try {
    logger.info('Processing logout request');
    await pool.query(authQueries.DELETE_TOKEN, [token]);
    logger.info('User logged out successfully');
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error(`Error during logout: ${error.message}`);
    res.status(500).json({ message: "Error logging out" });
  }
};

// **REFRESH TOKEN**
const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    logger.warn('Token refresh attempt without refresh token');
    return res.status(400).json({ message: "Refresh token required" });
  }

  try {
    logger.info('Processing token refresh request');
    
    // Check if the refresh token exists and is still valid
    const tokenEntry = await pool.query(
      'SELECT user_id FROM tokens WHERE token = $1 AND type = $2 AND expires_at > NOW()',
      [token, 'refresh']
    );

    if (tokenEntry.rows.length === 0) {
      logger.warn('Token refresh attempt with invalid or expired refresh token');
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    const newAccessToken = generateToken();
    const accessTokenExpiry = calculateTokenExpiry('access');
    
    await pool.query(
      'INSERT INTO tokens (user_id, token, type, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenEntry.rows[0].user_id, newAccessToken, 'access', accessTokenExpiry]
    );
    
    logger.info(`Generated new access token for user: ${tokenEntry.rows[0].user_id}`);

    res.json({ 
      accessToken: newAccessToken,
      accessTokenExpiry
    });
  } catch (error) {
    logger.error(`Error refreshing token: ${error.message}`);
    res.status(500).json({ message: "Error refreshing token" });
  }
};

// **GET CURRENT USER**
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.user_id;
    logger.info(`Fetching user information for ID: ${userId}`);
    
    const userResult = await pool.query('SELECT user_id, name, email, created_at FROM users WHERE user_id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      logger.warn(`User not found with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    logger.debug(`User data retrieved for: ${userResult.rows[0].email}`);
    res.status(200).json(userResult.rows[0]);
  } catch (error) {
    logger.error(`Error fetching current user: ${error.message}`);
    res.status(500).json({ message: 'Server error fetching user data' });
  }
};

// **CHANGE PASSWORD**
const changePassword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      logger.warn('Change password attempt with missing fields');
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    logger.info(`Processing password change for user ID: ${userId}`);
    
    // Get user's current password hash
    const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      logger.warn(`User not found with ID: ${userId} during password change`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    
    if (!validPassword) {
      logger.warn(`Incorrect current password provided for user ID: ${userId}`);
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashedPassword, userId]);
    
    // Optional: Invalidate existing tokens for security
    await pool.query('DELETE FROM tokens WHERE user_id = $1', [userId]);
    
    logger.info(`Password successfully changed for user ID: ${userId}`);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error(`Error changing password: ${error.message}`);
    res.status(500).json({ message: 'Server error changing password' });
  }
};

module.exports = { 
  register, 
  login, 
  logout, 
  refreshToken,
  getCurrentUser,
  changePassword
};
