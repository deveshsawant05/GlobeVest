const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../config/db");
const authQueries = require("../queries/authQueries");

// Generate secure random tokens
const generateToken = () => crypto.randomBytes(40).toString("hex");

// **REGISTER**
const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(authQueries.REGISTER_USER, [name, email, hashedPassword]);

    res.status(201).json({ message: "User registered", user: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering user" });
  }
};

// **LOGIN**
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await pool.query(authQueries.FIND_USER_BY_EMAIL, [email]);
    if (user.rows.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) return res.status(401).json({ message: "Invalid credentials" });

    // Generate tokens
    const accessToken = generateToken();
    const refreshToken = generateToken();

    await pool.query(authQueries.INSERT_TOKENS, [user.rows[0].user_id, accessToken, refreshToken]);

    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in" });
  }
};

// **LOGOUT**
const logout = async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ message: "Token required" });

  try {
    await pool.query(authQueries.DELETE_TOKEN, [token]);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging out" });
  }
};

// **REFRESH TOKEN**
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(400).json({ message: "Refresh token required" });

  try {
    const tokenEntry = await pool.query(authQueries.FIND_USER_BY_REFRESH_TOKEN, [refreshToken]);

    if (tokenEntry.rows.length === 0) return res.status(403).json({ message: "Invalid refresh token" });

    const newAccessToken = generateToken();
    await pool.query(authQueries.INSERT_ACCESS_TOKEN, [tokenEntry.rows[0].user_id, newAccessToken]);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error refreshing token" });
  }
};

module.exports = { register, login, logout, refreshToken };
