// middlewares/multer.middleware.js

import { extname } from "path";
import User from "../models/user/user.model.js";
import { frontError } from "../utils/responses.js";
import { v4 as uuidv4 } from "uuid";

// Set profile image path (for legacy local storage)
function setProfileImgPath(req, res, next) {
  req.storagePath = `../static/images/user/profile-img/`;
  next();
}

// Set email screenshot path (for S3)
function setEmailScreenshotsPath(req, res, next) {
  try {
    const userUid = req.userUid;
    if (!userUid) {
      console.error("User UID not found in request.");
      return frontError(res, "User UID not found.");
    }

    // Set the storage path for the current user
    req.storagePath = `uploads/user-${userUid}/email-screenshots/`;

    console.log("Storage Path Set:", req.storagePath);
    next();
  } catch (error) {
    console.error("Error setting email screenshot path:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Set email screenshot filename (S3) with improved error handling
async function setEmailScreenshotFilename(req, res, next) {
  try {
    if (!req.userUid) {
      console.error("User UID not found in request.");
      return frontError(res, "User UID not found.");
    }

    if (!req.file || !req.file.originalname) {
      console.error("File information is missing in the request.");
      return frontError(res, "File information is missing.");
    }

    const userUid = req.userUid;
    const user = await User.findByPk(userUid);
    if (!user) return frontError(res, "Invalid token.");

    const username = user.username || "anonymous";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Use the original file extension or default to .jpg
    const fileExt = extname(req.file.originalname) || ".jpg";

    // Generate a structured S3 key
    const s3Key = `uploads/user-${userUid}/${username}/${timestamp}/file_${uuidv4()}${fileExt}`;

    req.s3Key = s3Key;

    console.log("Generated S3 Key:", s3Key);

    next();
  } catch (error) {
    console.error("Error generating filename:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// ✅ Export all functions
export {
  setProfileImgPath,
  setEmailScreenshotFilename,
  setEmailScreenshotsPath,
};
