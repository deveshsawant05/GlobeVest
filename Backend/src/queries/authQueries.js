const authQueries = {
    REGISTER_USER: `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, name, email`,
    
    FIND_USER_BY_EMAIL: `SELECT * FROM users WHERE email = $1`,
  
    INSERT_TOKENS: `INSERT INTO tokens (user_id, token, type) VALUES ($1, $2, 'access'), ($1, $3, 'refresh')`,
  
    DELETE_TOKEN: `DELETE FROM tokens WHERE token = $1`,
  
    FIND_USER_BY_REFRESH_TOKEN: `SELECT user_id FROM tokens WHERE token = $1 AND type = 'refresh'`,
  
    INSERT_ACCESS_TOKEN: `INSERT INTO tokens (user_id, token, type) VALUES ($1, $2, 'access')`,
  
    VALIDATE_ACCESS_TOKEN: `SELECT user_id FROM tokens WHERE token = $1 AND type = 'access'`
  };
  
  module.exports = authQueries;
  