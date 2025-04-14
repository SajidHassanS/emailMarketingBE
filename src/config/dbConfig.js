<<<<<<< HEAD
// Import required modules and configuration
import chalk from "chalk";
import { Sequelize } from "sequelize";
import { dbUrl } from "./initialConfig.js";

const sequelize = new Sequelize(dbUrl);

// Async function to connect to the MongoDB database
export const connectDB = async () => {
  try {
    // Connect to the database with the provided URL and name
    await sequelize.authenticate();

    // Log success message in green
    console.log(`${chalk.green.bold("Connected to the database")}`);
    console.log(
      `${chalk.green.bold(
        "============================================================"
      )}`
    );
    await sequelize.sync();

    console.log(`${chalk.green.bold("Models synced successfully")}`);
    console.log(
      `${chalk.green.bold(
        "============================================================"
      )}`
    );
  } catch (error) {
    // Log error message in red and exit the application
    console.log(`${chalk.red.bold("Error")} connecting to database `, error);
    console.log(
      `${chalk.green.bold(
        "============================================================"
      )}`
    );
    process.exit(1);
  }
};
// Export the connectDB function
=======
import { Sequelize } from "sequelize";
import chalk from "chalk";

// You can move these to a config file later
const dbName = "project3";
const dbUser = "postgres";
const dbPass = "hassan526688";
const dbHost = "project3.c7q4kemc23tb.eu-north-1.rds.amazonaws.com";

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: 5432,
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: console.log, // Optional: shows SQL queries
});

export const connectDB = async () => {
  try {
    console.log(chalk.cyan("▶ Connecting to database with manual config..."));
    console.log("▶ Dialect Options:", sequelize.options.dialectOptions);

    await sequelize.authenticate();

    console.log(chalk.green.bold("✅ Connected to the database"));
    await sequelize.sync();
    console.log(chalk.green.bold("✅ Models synced successfully"));
  } catch (error) {
    console.error(chalk.red.bold("❌ Error connecting to database:"), error);
    process.exit(1);
  }
};

>>>>>>> main
export default sequelize;
