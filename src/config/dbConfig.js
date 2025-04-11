import chalk from "chalk";
import { Sequelize } from "sequelize";
import { dbUrl } from "./initialConfig.js";

// Log the DB URL being used (masked for safety in real projects)
console.log(chalk.blue("Loaded DB URL from config:"), dbUrl);

// Initialize Sequelize with full SSL config
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: console.log, // Optional: show raw SQL logs
});

// Async function to connect to the database
export const connectDB = async () => {
  try {
    console.log(
      chalk.cyanBright("▶ Connecting to database with:"),
      process.env.DATABASE_URL
    );

    // Log Sequelize dialect options to verify runtime config
    console.log("▶ Dialect Options:", sequelize.options.dialectOptions);

    // Attempt DB connection
    await sequelize.authenticate();

    console.log(chalk.green.bold("✅ Connected to the database"));
    console.log(
      chalk.green(
        "============================================================"
      )
    );

    // Sync Sequelize models
    await sequelize.sync();
    console.log(chalk.green.bold("✅ Models synced successfully"));
    console.log(
      chalk.green(
        "============================================================"
      )
    );
  } catch (error) {
    console.error(chalk.red.bold("❌ Error connecting to database:"), error);
    console.log(
      chalk.red("============================================================")
    );
    process.exit(1); // Crash the app intentionally on DB connection failure
  }
};

// Export Sequelize instance
export default sequelize;
