import express from "express";
import * as notificationCtrl from "../../controllers/notification/notification.controller.js";
import verifyToken from "../../middlewares/authMiddleware.js";
import {
  setEmailScreenshotFilename,
  setEmailScreenshotsPath,
} from "../../middlewares/multer.middleware.js";
import upload from "../../config/multer.config.js";

const router = express.Router();

// Email routes
router.route("/").get(verifyToken, notificationCtrl.getNotificationDetails);
//   .post(
//     verifyToken,
//     setEmailScreenshotsPath, // Set the directory path
//     setEmailScreenshotFilename, // Generate filename dynamically
//     upload.single("emailScreenshot"),
//     notificationCtrl.uploadEmailScreenshot
//   );

router.route("/all").get(verifyToken, notificationCtrl.getAllNotifications); // Get all emails
router
  .route("/read")
  .post(verifyToken, notificationCtrl.markNotificationAsRead);
router.route("/unread-count").get(verifyToken, notificationCtrl.getUnreadCount);
router
  .route("/mark-all-read")
  .post(verifyToken, notificationCtrl.markAllNotificationsAsRead);

export default router;
