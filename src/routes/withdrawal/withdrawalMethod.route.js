import express from "express";
import * as withdrawalMethodCtrl from "../../controllers/withdrawal/withdrawalMethod.controller.js"; // Controller import
import verifyToken from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Routes for managing withdrawal methods
router
  .route("/")
  .get(verifyToken, withdrawalMethodCtrl.getWithdrawalMethods) // Add a new withdrawal method
  .post(verifyToken, withdrawalMethodCtrl.addWithdrawalMethod); // Add a new withdrawal method
// .patch(verifyToken, withdrawalMethodCtrl.updateWithdrawalMethod); // Update an existing method

router
  .route("/default")
  .patch(verifyToken, withdrawalMethodCtrl.setDefaultWithdrawalMethod); // Set a default withdrawal method

export default router;
