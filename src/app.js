// =========================================
//             Libraries Import
// =========================================
import dotenv from "dotenv";
dotenv.config(); // Load AWS and other environment variables

import chalk from "chalk";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import express from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import os from "os";
import { fileURLToPath } from "url";
import path from "path";
import { domain } from "./config/initialConfig.js";
import { S3Client } from "@aws-sdk/client-s3";
import { fromEnv } from "@aws-sdk/credential-providers";
// import passport from "./config/passport.js";

// =========================================
//             Code Import
// =========================================
import { nodeEnv, port } from "./config/initialConfig.js";
import { connectDB } from "./config/dbConfig.js";
import { getIPAddress } from "./utils/utils.js";
import "./models/models.js";
import authRoutes from "./routes/user/auth.route.js";
import profileRoutes from "./routes/user/profile.route.js";
import dashboardRoutes from "./routes/dashboard/dashboard.route.js";
import emailRoutes from "./routes/email/email.route.js";
import notificationRoutes from "./routes/notification/notification.route.js";
import withdrawalRoutes from "./routes/withdrawal/withdrawal.route.js";
import withdrawalMethodRoutes from "./routes/withdrawal/withdrawalMethod.route.js";
import messageRoutes from "./routes/message/message.route.js";

// =========================================
//          AWS S3 Configuration (v3)
// =========================================
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

// Expose the S3 client globally if needed
global.s3Client = s3Client;

// =========================================
//            Configurations
// =========================================
// Initialize the app
const app = express();

// Session setup (optional, for JWT or OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "yoursecret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: nodeEnv === "production" },
  })
);

// Load cookies
app.use(cookieParser());

// Essential security headers with Helmet
app.use(helmet());

// Enable CORS with default settings
const corsOptions = {
  origin: nodeEnv === "production" ? domain : "*",
  credentials: true, // Allow cookies if needed
};
app.use(cors(corsOptions));

// Logger middleware for development environment
if (nodeEnv !== "production") {
  app.use(morgan("dev"));
}

// Compress all responses
app.use(compression());

// Rate limiting to prevent brute-force attacks
app.use(
  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

// JSON and URL-encoded body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static directories (if you still need this for non-S3 assets)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remove the local static directory for screenshots (if fully moved to S3)
// app.use("/static", express.static(path.join(__dirname, "../../", "static")));

// =========================================
//            Routes
// =========================================
// Root path
app.get("/", (req, res) => {
  res.send("Welcome to User Dashboard Backend");
});

// Register routes
app.use("/api/user/auth", authRoutes);
app.use("/api/user/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/withdrawal", withdrawalRoutes);
app.use("/api/withdrawal-method", withdrawalMethodRoutes);
app.use("/api/chat", messageRoutes);

// =========================================
//            Global Error Handler
// =========================================
app.use((err, req, res, next) => {
  console.error(chalk.red(err.stack));
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: {},
  });
});

// =========================================
//          Database Connection
// =========================================
connectDB();

// =========================================
//            Server Start
// =========================================
app.listen(port, "0.0.0.0", () => {
  console.log(
    chalk.bgYellow.bold(
      ` 🚀 Server is listening at http://${getIPAddress()}:${port} `
    )
  );
});
