// config/multer.config.js
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { fromEnv } from "@aws-sdk/credential-providers";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";

// Initialize S3 client (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

// Multer S3 storage configuration
const BASE_UPLOAD_PATH = process.env.S3_BASE_UPLOAD_PATH || "uploads";

const storage = multerS3({
  s3: s3Client,
  bucket: process.env.S3_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    try {
      if (!file || !file.fieldname) {
        console.error("❌ File metadata is missing.");
        return cb(new Error("File metadata is missing."));
      }
      cb(null, { fieldName: file.fieldname });
    } catch (error) {
      console.error("❌ Error setting file metadata:", error);
      cb(error);
    }
  },
  key: (req, file, cb) => {
    try {
      // ✅ Extract user information
      const userUid = req.userUid || "unknown_user";

      // ✅ Generate timestamp without invalid characters for S3
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // ✅ Validate and extract file extension
      const fileExt = extname(file.originalname || "").toLowerCase();
      const allowedExtensions = /\.(jpeg|jpg|png|gif|webp)$/i;
      if (!allowedExtensions.test(fileExt)) {
        console.error("❌ Unsupported file format:", fileExt);
        return cb(
          new Error(
            "Unsupported file format. Allowed formats are JPEG, JPG, PNG, GIF, WEBP."
          )
        );
      }

      // ✅ Generate a unique filename
      const filename = `${uuidv4()}${fileExt}`;

      // ✅ Set the folder path based on referral code (if present)
      const referralCode = req.body?.referralCode?.trim() || null;
      let folderPath;

      if (referralCode) {
        folderPath = `${BASE_UPLOAD_PATH}/referrals/${referralCode}`;
      } else if (userUid && userUid !== "unknown_user") {
        folderPath = `${BASE_UPLOAD_PATH}/users/${userUid}`;
      } else {
        console.error("❌ Missing user UID and referral code.");
        return cb(new Error("Missing user UID and referral code."));
      }

      // ✅ Construct the final S3 key
      const s3Key = `${folderPath}/${timestamp}/${filename}`;

      console.log(`🔄 Uploading file for user: ${userUid}`);
      console.log(`🔄 Referral code: ${referralCode || "None"}`);
      console.log(`✅ Generated S3 Key: ${s3Key}`);

      cb(null, s3Key);
    } catch (error) {
      console.error("❌ Error generating S3 key:", error);
      cb(error);
    }
  },
});

export default multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    try {
      // ✅ Validate file extension again for extra security
      const allowedExtensions = /\.(jpeg|jpg|png|gif|webp)$/i;
      if (
        allowedExtensions.test(extname(file.originalname || "").toLowerCase())
      ) {
        cb(null, true);
      } else {
        console.error("❌ Unsupported file format:", file.originalname);
        cb(
          new Error(
            "Unsupported file format. Allowed formats are JPEG, JPG, PNG, GIF, WEBP."
          )
        );
      }
    } catch (error) {
      console.error("❌ Error validating file extension:", error);
      cb(error);
    }
  },
});
