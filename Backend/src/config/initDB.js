const fs = require("fs");
const path = require("path");
const pool = require("./db");

const initDB = async () => {
  try {
    console.log("Initializing database...");

    // Read and execute schema.sql every time the server starts
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Split multiple SQL statements (only works if queries are separated by semicolons)
    await pool.query(schema);

    console.log("Database schema executed successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

// Ensure initDB runs when this file is imported
module.exports = initDB;
