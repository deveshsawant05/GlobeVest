const fs = require("fs");
const path = require("path");
const pool = require("./db");

const initDB = async () => {
  try {
    console.log("Initializing database...");

    // Execute schema.sql (Tables & constraints)
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schema);
    console.log("Database schema executed successfully.");

    // Execute triggers.sql (Triggers & functions)
    // const triggersPath = path.join(__dirname, "triggers.sql");
    // const triggers = fs.readFileSync(triggersPath, "utf8");
    // await pool.query(triggers);
    // console.log("Database triggers executed successfully.");

  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

// Ensure initDB runs when this file is imported
module.exports = initDB;
