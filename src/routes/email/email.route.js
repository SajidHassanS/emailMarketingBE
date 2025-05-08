// routes/email.routes.js
import express from "express";
import * as emailCtrl from "../../controllers/email/email.controller.js";
import verifyToken from "../../middlewares/authMiddleware.js";
import { setEmailScreenshotFilename } from "../../middlewares/multer.middleware.js";
import upload from "../../config/multer.config.js";

const router = express.Router();

// ========================= Email Routes ============================

// ✅ Correct Middleware Order
router.post(
  "/",
  verifyToken,
  upload.single("emailScreenshot"), // Populate req.file
  setEmailScreenshotFilename, // Now req.file is available
  emailCtrl.uploadEmailScreenshot
);

router.get("/all", verifyToken, emailCtrl.getAllEmails);
router.get("/stats", verifyToken, emailCtrl.getEmailStats);
router.get("/duplicate/all", verifyToken, emailCtrl.getAllDuplicateEmails);

export default router;
