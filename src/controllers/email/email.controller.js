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
import { uniqueNamesGenerator, names } from "unique-names-generator"; // Generates realistic names
// import Email from "../../models/email/email.model.js";
import { emailPass } from "../../config/initialConfig.js";
import path, { extname, resolve } from "path";
import { existsSync, mkdirSync, readdirSync } from "fs";
const { Password, User, Email, DuplicateEmail } = models;
import Tesseract from "tesseract.js";
import { log } from "console";
import { createNotification } from "../notification/notification.controller.js";
import Admin from "../../models/admin/admin.model.js";
import { saveMessageToDB } from "../../utils/messageUtils.js";

// ========================= Upload Gmail Screenshot ============================

// export async function uploadEmailScreenshot(req, res) {
//   try {
//     const userUid = req.userUid;

//     if (!req.file) {
//       return frontError(res, "No file uploaded.");
//     }
//     const { filename, path } = req.file; // filename from multer config

//     // If emailScreenshot is provided, handle the upload
//     const emailScreenshotPath = getRelativePath(req.file.path); // Get the relative path for the image

//     // ✅ Perform OCR to extract text from the screenshot
//     const { data } = await Tesseract.recognize(path, "eng"); // Extract text
//     const extractedText = data.text;

//     console.log("Extracted Text:", extractedText); // Debugging

//     // ✅ Extract Emails from the Text
//     const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
//     const extractedEmails = extractedText.match(emailRegex) || [];

//     console.log("Extracted Emails:", extractedEmails); // Debugging

//     // ✅ Insert each email into the database
//     if (extractedEmails.length === 0) {
//       return frontError(res, "No valid email found in the screenshot.");
//     }

//     // ✅ Check for duplicates
//     const existingEmails = await Email.findAll({
//       where: { email: extractedEmails },
//       attributes: ["email"],
//     });

//     console.log("========================================");
//     console.log("===== existingEmails ===== : ", existingEmails);
//     console.log("========================================");

//     // const existingEmails = [
//     //   { email: "test1@example.com" },
//     //   { email: "test2@example.com" },
//     //   { email: "test3@example.com" },
//     // ];

//     // const extractedEmails = [
//     //   "test1@example.com",
//     //   "test2@example.com",
//     //   "test3@example.com",
//     // ];

//     const existingEmailList = existingEmails.map((e) => e.email);
//     const newEmails = extractedEmails.filter(
//       (email) => !existingEmailList.includes(email)
//     );

//     if (existingEmailList.length > 0) {
//       // ✅ If only one email is uploaded and it's a duplicate
//       if (extractedEmails.length === 1) {
//         // Create a notification for single duplicate
//         await createNotification({
//           userUuid: userUid,
//           message:
//             "Duplicate email was found. Please check notifications for more details.",
//           title: "Duplicate Email Found",
//           type: "duplicate_email",
//           metadata: {
//             duplicateEmails: existingEmailList,
//           },
//         });
//         return validationError(
//           res,
//           `The email "${extractedEmails[0]}" has already been uploaded. Duplicate entries are not allowed.`
//         );
//       }

//       // ✅ If multiple emails are uploaded, separate the message
//       let message = `${existingEmailList.length} duplicate emails were found.`;

//       if (newEmails.length > 0) {
//         message += ` The remaining emails have been successfully processed.`;
//       }

//       message += ` Please check notifications for more details.`;

//       console.log("========================================");
//       console.log("===== message ===== : ", message);
//       console.log("========================================");

//       // Create a notification for multiple duplicates
//       await createNotification({
//         userUuid: userUid,
//         message: message,
//         title: "Duplicate Emails Found",
//         type: "duplicate_email",
//         metadata: {
//           duplicateEmails: existingEmailList,
//         },
//       });

//       return validationError(res, message);
//     }

//     // get password assigned to user
//     const user = await User.findByPk(userUid, {
//       attributes: ["passwordUuid"],
//       include: {
//         model: Password,
//         attributes: ["uuid", "password"],
//       },
//     });

//     console.log("User ===== ===== ===== ===== :", user.Password?.password);

//     if (!user.Password || !user.Password.password) {
//       return validationError(
//         res,
//         "Cannot upload screenshot. Try again later. If the issue persists, contact admin. [Error Code: PASSWORD]"
//       );
//     }

//     const emailEntries = newEmails.map((email) => ({
//       email,
//       password: user.Password?.password,
//       fileName: filename,
//       emailScreenshot: emailScreenshotPath,
//       remarks: "Extracted from screenshot",
//       userUuid: userUid,
//     }));

//     await Email.bulkCreate(emailEntries); // Insert all emails at once

//     // Create a notification for the successful upload
//     await createNotification({
//       userUuid: userUid,
//       message: `${newEmails.length} new emails have been successfully uploaded and processed.`,
//       type: "success",
//     });

//     // const emailEntries = [];
//     // for (const email of extractedEmails) {
//     //   const existingEmail = await Email.findOne({ where: { email } });

//     //   if (existingEmail) {
//     //     // ✅ Email already exists → Log in DuplicateEmail table
//     //     await DuplicateEmail.create({
//     //       emailUuid: existingEmail.uuid,
//     //       uploadedByUuid: userUid,
//     //       fileName: filename,
//     //     });

//     //     // ✅ Send notification to user
//     //     // await Notification.create({
//     //     //   // userUuid,
//     //     //   userUuid: userUid,
//     //     //   message: `Duplicate email detected: ${email}. Previously uploaded at ${existingEmail.createdAt}.`,
//     //     //   type: "warning",
//     //     // });

//     //     console.log(`Duplicate email detected: ${email}`);
//     //   } else {
//     //     // ✅ New email → Save in Email table
//     //     emailEntries.push({
//     //       email,
//     //       password: user.Password?.password,
//     //       fileName: filename,
//     //       emailScreenshot: emailScreenshotPath,
//     //       remarks: "Extracted from screenshot",
//     //       // userUuid,
//     //       userUuid: userUid,
//     //       status: "pending",
//     //     });
//     //   }
//     // }

//     // if (emailEntries.length > 0) {
//     //   await Email.bulkCreate(emailEntries); // Insert non-duplicate emails
//     // }

//     return successOk(
//       res,
//       "Email screenshot uploaded & processed successfully."
//     );
//   } catch (error) {
//     console.log("========================================");
//     console.log("===== Error ===== : ", error);
//     console.log("========================================");
//     return catchError(res, error);
//   }
// }

export async function uploadEmailScreenshot(req, res) {
  try {
    const userUid = req.userUid;

    if (!req.file) {
      return frontError(res, "No file uploaded.");
    }

    const { filename, path } = req.file;
    const emailScreenshotPath = getRelativePath(req.file.path);

    const { data } = await Tesseract.recognize(path, "eng");
    const extractedText = data.text;

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const extractedEmails = extractedText.match(emailRegex) || [];

    if (extractedEmails.length === 0) {
      return frontError(res, "No valid email found in the screenshot.");
    }

    const existingEmails = await Email.findAll({
      where: { email: extractedEmails },
      attributes: ["uuid", "email", "status"],
    });

    const existingEmailList = existingEmails.map((e) => e.email);
    const newEmails = extractedEmails.filter(
      (email) => !existingEmailList.includes(email)
    );

    // Get user's assigned password
    const user = await User.findByPk(userUid, {
      attributes: ["passwordUuid"],
      include: {
        model: Password,
        attributes: ["uuid", "password"],
      },
    });

    if (!user.Password || !user.Password.password) {
      return validationError(
        res,
        "Cannot upload screenshot. Try again later. If the issue persists, contact admin. [Error Code: PASSWORD]"
      );
    }

    const emailEntries = [];

    // Create new email entries
    for (const email of newEmails) {
      emailEntries.push({
        email,
        password: user.Password.password,
        fileName: filename,
        emailScreenshot: emailScreenshotPath,
        remarks: "",
        userUuid: userUid,
        status: "pending",
      });
    }

    // Bulk insert new emails
    if (emailEntries.length > 0) {
      await Email.bulkCreate(emailEntries);
    }

    // Log duplicate emails in DuplicateEmail table
    for (const existing of existingEmails) {
      await DuplicateEmail.create({
        emailUuid: existing.uuid,
        uploadedByUuid: userUid,
        fileName: filename,
      });
    }

    // Get system admin for notification messages in chat
    let systemAdmin = await Admin.findOne({
      where: { username: "systemadmin" },
    });

    if (!systemAdmin) systemAdmin = await Admin.findOne(); // fallback to any admin

    // Notify user
    if (existingEmailList.length > 0) {
      const title =
        existingEmailList.length === 1
          ? "Duplicate Email Found"
          : "Duplicate Emails Found";

      let message = `${existingEmailList.length} duplicate email(s) detected.`;
      if (newEmails.length > 0) {
        message += ` The remaining ${newEmails.length} email(s) were uploaded successfully.`;
      }

      await createNotification({
        userUuid: userUid,
        title,
        message,
        type: "duplicate_email",
        metadata: { duplicateEmails: existingEmailList },
      });

      if (systemAdmin) {
        await saveMessageToDB({
          senderUuid: systemAdmin.uuid,
          senderType: "admin",
          receiverUuid: userUid,
          receiverType: "user",
          content: `${message} ----- duplicateEmails: ${existingEmailList}`,
          isNotification: true,
        });
      } else {
        console.warn("⚠️ No admin found. Skipping system notification.");
      }

      return validationError(res, message);
    }

    // All emails were new
    await createNotification({
      userUuid: userUid,
      title: "New Email(s) Uploaded",
      message: `${newEmails.length} new email(s) have been successfully uploaded and processed.`,
      type: "success",
    });

    if (systemAdmin) {
      await saveMessageToDB({
        senderUuid: systemAdmin.uuid,
        senderType: "admin",
        receiverUuid: userUid,
        receiverType: "user",
        content: `New Email(s) Uploaded ----- ${newEmails.length} new email(s) have been successfully uploaded and processed.`,
        isNotification: true,
      });
    } else {
      console.warn("⚠️ No admin found. Skipping system notification.");
    }

    return successOk(
      res,
      "Email screenshot uploaded & processed successfully."
    );
  } catch (error) {
    console.log("===== Error ===== :", error);
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
      // include: [
      //   {
      //     model: User,
      //     as: "user",
      //     attributes: ["uuid", "username"],
      //   },
      // ],
    });

    if (!emails.length) return notFound(res, "No emails found.");

    return successOkWithData(res, "Profile fetched successfully", emails);
  } catch (error) {
    return catchError(res, error);
  }
}

// ======================== Get Email Stats =================================

export async function getEmailStats(req, res) {
  try {
    const userUuid = req.userUid
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
