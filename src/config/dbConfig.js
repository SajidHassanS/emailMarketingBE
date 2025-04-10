// Import required modules and configuration
import chalk from "chalk";
import { Sequelize } from "sequelize";
import { dbUrl } from "./initialConfig.js";

const sequelize = new Sequelize(dbUrl);

// Async function to connect to the MongoDB database
export const connectDB = async () => {
  try {
    // 🔍 DEBUG: Print the actual DB URL being used
    console.log(
      chalk.blue.bold("Connecting to DB with:"),
      process.env.DATABASE_URL
    );

    // Connect to the database
    await sequelize.authenticate();

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
    console.log(`${chalk.red.bold("Error")} connecting to database `, error);
    console.log(
      `${chalk.green.bold(
        "============================================================"
      )}`
    );
    process.exit(1); // This is what's crashing your app — leave it in for now
  }
};

// Export the connectDB function
export default sequelize;
