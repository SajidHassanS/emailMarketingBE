import express from "express";
import * as messageCtrl from "../../controllers/message/message.controller.js";
import verifyToken from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Message routes

router
    .route("/admins")
    .get(verifyToken, messageCtrl.getAdminsChattedWithUser)

router
    .route("/messages")
    .get(verifyToken, messageCtrl.getAdminMessages)

router
    .route("/unread-count")
    .get(verifyToken, messageCtrl.getUnreadMessageCount)

router
    .route("/mark-as-read")
    .post(verifyToken, messageCtrl.markMessagesAsRead)

export default router;
