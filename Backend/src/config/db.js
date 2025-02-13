const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config(); // Load environment variables

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required if using a remote PostgreSQL server
  },
});

module.exports = pool;

