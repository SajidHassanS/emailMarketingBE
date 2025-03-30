import { Op, Sequelize } from "sequelize";
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
import { uniqueNamesGenerator, names } from "unique-names-generator"; // Generates realistic names
// import Email from "../../models/email/email.model.js";
import { emailPass } from "../../config/initialConfig.js";
import path, { extname, resolve } from "path";
import { existsSync, mkdirSync, readdirSync } from "fs";
const { Password, User, Email } = models;
import Tesseract from "tesseract.js";

// ========================= Upload Gmail Screenshot ============================

export async function uploadEmailScreenshot(req, res) {
  try {
    const userUid = req.userUid;

    if (!req.file) {
      return frontError(res, "No file uploaded.");
    }
    const { filename, path } = req.file; // filename from multer config

    // If emailScreenshot is provided, handle the upload
    const emailScreenshotPath = getRelativePath(req.file.path); // Get the relative path for the image

    // ✅ Perform OCR to extract text from the screenshot
    const { data } = await Tesseract.recognize(path, "eng"); // Extract text
    const extractedText = data.text;

    console.log("Extracted Text:", extractedText); // Debugging

    // ✅ Extract Emails from the Text
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const extractedEmails = extractedText.match(emailRegex) || [];

    console.log("Extracted Emails:", extractedEmails); // Debugging

    // ✅ Insert each email into the database
    if (extractedEmails.length === 0) {
      return frontError(res, "No valid email found in the screenshot.");
    }

    // get password assigned to user
    const user = await User.findByPk(userUid, {
      attributes: ["passwordUuid"],
      include: {
        model: Password,
        attributes: ["uuid", "password"],
      },
    });

    console.log("User ===== ===== ===== ===== :", user.Password?.password);

    const emailEntries = extractedEmails.map((email) => ({
      email,
      password: user.Password?.password,
      fileName: filename,
      emailScreenshot: emailScreenshotPath,
      remarks: "Extracted from screenshot",
      userUuid: userUid,
    }));

    await Email.bulkCreate(emailEntries); // Insert all emails at once

    return successOk(
      res,
      "Email screenshot uploaded & processed successfully."
    );
  } catch (error) {
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
    } = req.query;

    // Build the query conditions
    const whereCondition = {
      userUuid: userUid,
    };

    // Apply status filter if provided
    if (status) {
      whereCondition.status = status;
    }

    // Apply date range filter (adjusted to cover the entire day)
    if (startDate) {
      whereCondition.createdAt = {
        [Op.gte]: new Date(`${startDate}T00:00:00.000Z`), // Start of the day
      };
    }
    if (endDate) {
      whereCondition.createdAt = {
        ...(whereCondition.createdAt || {}),
        [Op.lte]: new Date(`${endDate}T23:59:59.999Z`), // End of the day
      };
    }

    // Fetch filtered and ordered emails
    const emails = await Email.findAll({
      where: whereCondition,
      order: [[orderBy, order.toUpperCase()]], // Ensure order is uppercase (ASC/DESC)
      include: [
        {
          model: User,
          as: "user",
          attributes: ["uuid", "username"],
        },
      ],
    });

    if (!emails.length) return notFound(res, "No emails found.");

    return successOkWithData(res, "Profile fetched successfully", emails);
  } catch (error) {
    return catchError(res, error);
  }
}
