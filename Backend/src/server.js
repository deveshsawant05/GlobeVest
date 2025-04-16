const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const initDB = require("./config/initDB");
const authRoutes = require("./routes/auth");
const homeRoutes = require("./routes/home"); 
const walletRoutes = require("./routes/walletRoutes");
const stockRoutes = require("./routes/stockRoutes");
const tradeRoutes = require("./routes/tradeRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

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

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: [ process.env.FRONTEND_URL || 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Initialize database schema on startup
log('info', 'Initializing database schema');
initDB();

// Home & Status routes
app.use("/", homeRoutes); 
app.use("/status", (req, res) => {
  log('debug', 'Status check request received');
  res.status(200).json({ status: "Server is running" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/transactions", transactionRoutes);

// Error handler middleware
app.use((err, req, res, next) => {
  log('error', `Unhandled error: ${err.message}`);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  log('info', `Server running on port ${PORT}`);
});
