const express = require("express");
const dotenv = require("dotenv");
const initDB = require("./config/initDB");
const authRoutes = require("./routes/auth");
const homeRoutes = require("./routes/home"); 

dotenv.config();
const app = express();
app.use(express.json());

// Initialize database schema on startup
initDB();

app.use("/", homeRoutes); 
app.use("/api/auth", authRoutes);

app.use("/status", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
