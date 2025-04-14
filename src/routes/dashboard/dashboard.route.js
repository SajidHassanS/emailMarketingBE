import express from "express";
import * as dashboardCtrl from "../../controllers/dashboard/dashboard.controller.js";
import verifyToken from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Dashboard routes
router
    .route("/unique-name-and-pass")
    .get(verifyToken, dashboardCtrl.getUniqueNameAndPassword)

export default router;