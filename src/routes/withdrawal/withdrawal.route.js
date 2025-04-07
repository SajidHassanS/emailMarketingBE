import express from "express";
import * as withdrawalCtrl from "../../controllers/withdrawal/withdrawal.controller.js";
import verifyToken from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Email routes

router
  .route("/available-balance")
  .get(verifyToken, withdrawalCtrl.getAvailableBalance); // Get available balance

router.route("/request").post(verifyToken, withdrawalCtrl.requestWithdrawal); //  Request withdrawal

router.route("/my").get(verifyToken, withdrawalCtrl.getMyWithdrawals); // Get all withdrawal requests

// router
//   .route("/")
//   .get(verifyToken, withdrawalCtrl.getAllEmails) // Temporary Get all email
//   .patch(verifyToken, withdrawalCtrl.updateEmailStatus); // Update email

// router
//   .route("/bulk-update")
//   .patch(verifyToken, withdrawalCtrl.bulkUpdateEmailStatusByUuids); // Bulk update email's status

// router.route("/stats").get(verifyToken, withdrawalCtrl.getEmailStats); // Email stats

// router
//   .route("/duplicate/all")
//   .get(verifyToken, withdrawalCtrl.getAllDuplicateEmails); // Get all duplicate emails
export default router;
