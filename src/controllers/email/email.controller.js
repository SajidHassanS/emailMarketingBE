// ========================= Libraries Import =========================
import { Op, Sequelize, ValidationError } from "sequelize";
import { bodyReqFields, queryReqFields } from "../../utils/requiredFields.js";
import {
  created,
  catchError,
  successOk,
  successOkWithData,
  sequelizeValidationError,
  frontError,
  validationError,
  notFound,
} from "../../utils/responses.js";
import { convertToLowercase, getRelativePath } from "../../utils/utils.js";
import models from "../../models/models.js";
import { validatePassword } from "../../utils/passwordUtils.js";
import { uniqueNamesGenerator, names } from "unique-names-generator";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import Tesseract from "tesseract.js";
import { createNotification } from "../notification/notification.controller.js";
import Admin from "../../models/admin/admin.model.js";
import { saveMessageToDB } from "../../utils/messageUtils.js";
import PQueue from "p-queue"; // For rate limiting

// Initialize S3 client (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const { Password, User, Email, DuplicateEmail } = models;

// ========================= Azure OCR SDK ============================
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const createImageAnalysisClient =
  require("@azure-rest/ai-vision-image-analysis").default;
const { AzureKeyCredential } = require("@azure/core-auth");
const endpoint = process.env.COMPUTER_VISION_ENDPOINT;
const key = process.env.COMPUTER_VISION_KEY;
const client = createImageAnalysisClient(endpoint, new AzureKeyCredential(key));

// ========================= Helper Functions =========================
function generateS3Url(key) {
  const bucketName = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

const queue = new PQueue({ concurrency: 3 }); // Limit Tesseract processing

// ========================= Upload Email Screenshot =========================
export async function uploadEmailScreenshot(req, res) {
  try {
    const userUid = req.userUid;

    if (!req.file) {
      return frontError(res, "No file uploaded.");
    }

    const { key, bucket } = req.file;
    const filename = key.split("/").pop() || "unknown_file";
    const fullUrl = generateS3Url(key);

    console.log("Uploaded S3 Key:", key);
    console.log("Full URL:", fullUrl);

    const fileStream = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    const buffer = await streamToBuffer(fileStream.Body);
    if (!buffer || buffer.length === 0) {
      return frontError(res, "File is empty.");
    }

    let extractedEmails = [];
    try {
      const azureResponse = await client.path("/imageanalysis:analyze").post({
        body: buffer,
        queryParameters: { features: ["Read"] },
        headers: { "Content-Type": "application/octet-stream" },
      });

      const blocks = azureResponse.body.readResult.blocks || [];
      const azureLines = blocks.flatMap((block) =>
        block.lines.map((line) => line.text)
      );
      const azureExtractedText = azureLines.join("\n");
      extractedEmails =
        azureExtractedText.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
        ) || [];
    } catch (azureError) {
      console.error("Azure OCR failed:", azureError);
    }

    if (extractedEmails.length === 0) {
      const tesseractExtractedText = await queue.add(async () => {
        const result = await Tesseract.recognize(buffer);
        return result.data.text;
      });
      extractedEmails =
        tesseractExtractedText.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
        ) || [];
    }

    if (extractedEmails.length === 0) {
      return frontError(res, "No valid email found in the screenshot.");
    }

    const existingEmails = await Email.findAll({
      where: { email: extractedEmails },
      attributes: ["uuid", "email", "status"],
    });

    const existingEmailList = new Set(existingEmails.map((e) => e.email));
    const newEmails = extractedEmails.filter(
      (email) => !existingEmailList.has(email)
    );

    const user = await User.findByPk(userUid, {
      attributes: ["passwordUuid"],
      include: {
        model: Password,
        attributes: ["uuid", "password"],
      },
    });

    if (!user || !user.Password?.password) {
      return validationError(res, "Password not found.");
    }

    const emailEntries = newEmails.map((email) => ({
      email,
      password: user.Password.password,
      fileName: filename,
      emailScreenshot: key,
      remarks: "",
      userUuid: userUid,
      status: "pending",
    }));

    if (emailEntries.length > 0) {
      await Email.bulkCreate(emailEntries);
    }

    // Log duplicate emails
    for (const existing of existingEmails) {
      await DuplicateEmail.findOrCreate({
        where: {
          emailUuid: existing.uuid,
          uploadedByUuid: userUid,
        },
        defaults: {
          fileName: filename, // ✅ Include the filename to avoid the NOT NULL violation
        },
      });
    }

    const title =
      existingEmailList.size === 1
        ? "Duplicate Email Found"
        : "Duplicate Emails Found";
    const message = `${existingEmailList.size} duplicate email(s) detected.`;

    await createNotification({
      userUuid: userUid,
      title,
      message,
      type: "duplicate_email",
      metadata: { duplicateEmails: Array.from(existingEmailList) },
    });

    return successOk(
      res,
      "Email screenshot uploaded & processed successfully.",
      {
        url: fullUrl,
        extractedEmails,
      }
    );
  } catch (error) {
    console.error("Error processing email screenshot:", error);
    return catchError(res, error);
  }
}

// ========================= Get All Emails ============================

export async function getAllEmails(req, res) {
  try {
    const userUid = req.userUid;

    const {
      status,
      startDate,
      endDate,
      orderBy = "createdAt",
      order = "DESC",
      limit = 20,
      offset = 0,
      search,
    } = req.query;

    // Build the query conditions
    const whereCondition = { userUuid: userUid };

    // Apply status filter if provided
    if (status) {
      whereCondition.status = status;
    }

    // Apply search filter if provided (matches email address)
    if (search) {
      whereCondition.email = { [Op.iLike]: `%${search}%` };
    }

    // Apply date range filter (adjusted to cover the entire day)
    if (startDate) {
      whereCondition.createdAt = {
        [Op.gte]: new Date(`${startDate}T00:00:00.000Z`),
      };
    }

    if (endDate) {
      whereCondition.createdAt = {
        ...(whereCondition.createdAt || {}),
        [Op.lte]: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    // Fetch filtered and ordered emails with pagination
    const emails = await Email.findAll({
      where: whereCondition,
      order: [[orderBy, order.toUpperCase()]], // Ensure order is uppercase (ASC/DESC)
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (!emails.length) return notFound(res, "No emails found.");

    // Add full S3 URL to each email entry
    const bucketName = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;
    const s3UrlPrefix = `https://${bucketName}.s3.${region}.amazonaws.com/`;

    const emailsWithFullUrl = emails.map((email) => {
      const emailData = email.toJSON();
      const screenshotPath = emailData.emailScreenshot;

      // Only add the prefix if it's not already a full URL
      if (!screenshotPath.startsWith("http")) {
        emailData.emailScreenshot = `${s3UrlPrefix}${screenshotPath}`;
      }

      return emailData;
    });

    return successOkWithData(
      res,
      "Emails fetched successfully",
      emailsWithFullUrl
    );
  } catch (error) {
    console.error("Error fetching emails:", error);
    return catchError(res, error);
  }
}

// ======================== Get Email Stats =================================

export async function getEmailStats(req, res) {
  try {
    const userUuid = req.userUid;
    const [pendingCount, goodCount, badCount, totalCount] = await Promise.all([
      Email.count({ where: { status: "pending", userUuid } }),
      Email.count({ where: { status: "good", userUuid } }),
      Email.count({ where: { status: "bad", userUuid } }),
      Email.count({ where: { userUuid } }),
    ]);

    const stats = {
      total: totalCount,
      pending: pendingCount,
      good: goodCount,
      bad: badCount,
    };

    return successOkWithData(res, "Email stats fetched successfully", stats);
  } catch (error) {
    console.error("===== Error fetching email stats ===== :", error);
    return catchError(res, error);
  }
}

// ===================== Get All Dulicate Emails ========================

export async function getAllDuplicateEmails(req, res) {
  try {
    const userUid = req.userUid;

    const duplicates = await DuplicateEmail.findAll({
      where: { uploadedByUuid: userUid },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Email,
          as: "originalEmail",
          attributes: ["uuid", "email", "status", "fileName", "createdAt"],
        },
        {
          model: User,
          as: "uploader",
          attributes: ["uuid", "username"], // Add more user fields if needed
        },
      ],
    });

    if (!duplicates.length)
      return notFound(res, "No duplicate emails found for this user.");

    return successOkWithData(
      res,
      "Duplicate emails fetched successfully.",
      duplicates
    );
  } catch (error) {
    console.log("===== Error fetching duplicate emails ===== :", error);
    return catchError(res, error);
  }
}
