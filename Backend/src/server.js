const express = require("express");
const dotenv = require("dotenv");
const initDB = require("./config/initDB");
const authRoutes = require("./routes/auth");

dotenv.config();
const app = express();
app.use(express.json());

// Initialize database schema on startup
initDB();

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
