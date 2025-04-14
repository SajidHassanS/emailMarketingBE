import express from "express";
import * as emailCtrl from "../../controllers/email/email.controller.js";
import verifyToken from "../../middlewares/authMiddleware.js";
import {
  setEmailScreenshotFilename,
  setEmailScreenshotsPath,
} from "../../middlewares/multer.middleware.js";
import upload from "../../config/multer.config.js";

const router = express.Router();

// Email routes
router
  .route("/")
  // .get(verifyToken, emailCtrl.getAllEmails) // Get all emails
  .post(
    verifyToken,
    setEmailScreenshotsPath, // Set the directory path
    setEmailScreenshotFilename, // Generate filename dynamically
    upload.single("emailScreenshot"),
    emailCtrl.uploadEmailScreenshot
  );

router.route("/all").get(verifyToken, emailCtrl.getAllEmails); // Get all emails

router.route("/stats").get(verifyToken, emailCtrl.getEmailStats); // Email stats

router
  .route("/duplicate/all")
  .get(verifyToken, emailCtrl.getAllDuplicateEmails); // Get all duplicate emails

export default router;
