const pool = require('../config/db');
const authQueries = require('../queries/authQueries');

// Logging utility
const log = (level, message) => {
  switch (level) {
    case 'debug':
      console.log(`[DEBUG] ${message}`);
      break;
    case 'error':
      console.error(`[ERROR] ${message}`);
      break;
    case 'info':
      console.info(`[INFO] ${message}`);
      break;
    case 'warn':
      console.warn(`[WARN] ${message}`);
      break;
    default:
      console.log(message);
  }
};

// Middleware to check if the request has a valid access token
const authenticateToken = async (req, res, next) => {
  // Get the token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
  
  if (!token) {
    log('warn', 'Access attempt without token');
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    log('debug', 'Validating access token');
    
    // Check if token exists in database and is not expired
    const result = await pool.query(
      'SELECT user_id FROM tokens WHERE token = $1 AND type = $2 AND expires_at > NOW()',
      [token, 'access']
    );
    
    if (result.rows.length === 0) {
      log('warn', 'Access attempt with invalid or expired token');
      return res.status(403).json({ 
        message: 'Invalid or expired token',
        tokenExpired: true
      });
    }
    
    // Fetch user data for the request
    const userId = result.rows[0].user_id;
    const userResult = await pool.query('SELECT user_id, name, email FROM users WHERE user_id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      log('warn', `User not found for ID: ${userId}`);
      return res.status(403).json({ message: 'User not found' });
    }
    
    // Add user object to request
    req.user = userResult.rows[0];
    log('debug', `Authenticated user: ${req.user.email}`);
    
    next();
  } catch (error) {
    log('error', `Authentication error: ${error.message}`);
    res.status(500).json({ message: 'Authentication server error' });
  }
};

module.exports = { authenticateToken }; 