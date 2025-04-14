import { extname, resolve } from "path";
import { readdirSync, existsSync } from "fs";
import User from "../models/user/user.model.js";
import { frontError } from "../utils/responses.js";
import fs from "fs";

export function setProfileImgPath(req, res, next) {
  req.storagePath = `../static/images/user/profile-img/`;
  next();
}

export function setEmailScreenshotsPath(req, res, next) {
  req.storagePath = `../static/images/user/email/${req.userUid}`;
  next();
}

export async function setEmailScreenshotFilename(req, res, next) {
  try {
    const userUid = req.userUid;

    // Fetch user deatils from DB
    const user = await User.findByPk(userUid);
    if (!user) return frontError(res, "Invalid token.");

    const username = user.username;
    const timestamp = Date.now();

    // Define user directory
    const uploadDir = resolve(`../static/images/user/email/${userUid}`);

    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Get existing files for this user
    const files = fs.readdirSync(uploadDir);

    // Find the highest incrementer
    let maxIncrement = 0;
    files.forEach((file) => {
      const match = file.match(new RegExp(`^${username}_\\d+_file_(\\d+)`));
      if (match) {
        const currentIncrement = parseInt(match[1], 10);
        if (currentIncrement > maxIncrement) {
          maxIncrement = currentIncrement;
        }
      }
    });

    // Increment properly
    const incrementer = maxIncrement + 1;

    // Set the new filename
    req.filename = `${username}_${timestamp}_file_${incrementer}`;

    console.log("Generated Filename:", req.filename);

    next();
  } catch (error) {
    console.error("Error generating filename:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
