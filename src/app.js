// =========================================
//             Lbraries Import
// =========================================
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
<<<<<<< Updated upstream
import messageRoutes from "./routes/message/message.route.js";
=======
>>>>>>> Stashed changes

// =========================================
//            Configurations
// =========================================
// Initializing the app
const app = express();
// app.use(passport.initialize());

// If you plan to use session-based flows (optional with JWT):
app.use(
  session({ secret: "yoursecret", resave: false, saveUninitialized: false })
);
// app.use(passport.session());

// ... your routes and rest of the code

app.use(cookieParser());

// Essential security headers with Helmet
app.use(helmet());

// Enable CORS with default settings
<<<<<<< Updated upstream
const crosOptions = {
  origin: nodeEnv === "production" ? domain : "*", // allow requests from all ips in development, and use array for multiple domains
  // allowedHeaders: ['Content-Type', 'Authorization', 'x-token', 'y-token'],    // allow these custom headers only
};
app.use(cors(crosOptions));
=======
const corsOptions = {
  origin: "*", // ✅ Allow any origin
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
>>>>>>> Stashed changes

// Logger middleware for development environment
if (nodeEnv !== "production") {
  app.use(morgan("dev"));
}

// Compress all routes
app.use(compression());

// Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Built-in middleware for parsing JSON
app.use(express.json());

// static directories
// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/static", express.static(path.join(__dirname, "../../", "static")));

// =========================================
//            Routes
// =========================================
// Route for root path
app.get("/", (req, res) => {
  res.send("Welcome to User Dashboard Backend");
});

// other routes
app.use("/api/user/auth", authRoutes);
app.use("/api/user/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/withdrawal", withdrawalRoutes);
app.use("/api/withdrawal-method", withdrawalMethodRoutes);
<<<<<<< Updated upstream
app.use("/api/chat", messageRoutes);
=======
>>>>>>> Stashed changes

// =========================================
//            Global Error Handler
// =========================================
// Global error handler
app.use((err, req, res, next) => {
  console.error(chalk.red(err.stack));
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: {},
  });
});

// Database connection
connectDB();

// Server running
app.listen(port, "0.0.0.0", () => {
  console.log(
    chalk.bgYellow.bold(
      ` Server is listening at http://${getIPAddress()}:${port} `
    )
  );
});
