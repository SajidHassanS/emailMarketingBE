import { Op } from "sequelize";
import models from "../../models/models.js";
import User from "../../models/user/user.model.js";
import {
  catchError,
  frontError,
  successOkWithData,
  validationError,
} from "../../utils/responses.js";
import SystemSetting from "../../models/systemSetting/systemSetting.model.js";
import { bodyReqFields } from "../../utils/requiredFields.js";
const { Email, Withdrawal, WithdrawalMethod, Bonus } = models;
import { createNotification } from "../notification/notification.controller.js";
import BonusWithdrawal from "../../models/withdrawal/bonusWithdrawal.model.js";

// Get Available Balance for the User
export async function getAvailableBalance(req, res) {
  try {
    const userUuid = req.userUid;

    // Get all emails that are marked "good" and are not withdrawn yet
    const emails = await Email.findAll({
      where: { userUuid, status: "good", isWithdrawn: false },
      attributes: ["amount"], // Only fetch the 'amount' column
    });

    const totalAmount = emails.reduce((sum, e) => sum + e.amount, 0);

    return successOkWithData(res, "Available balance fetched successfully.", {
      balance: totalAmount,
    });
  } catch (error) {
    console.log("Error fetching balance:", error);
    return catchError(res, error);
  }
}

// Request a withdrawal
export async function requestWithdrawal(req, res) {
  try {
    const userUuid = req.userUid;
    const { method } = req.body; // Optional: methodType to override default

    // Fetch user's default withdrawal method
    const defaultMethod = await WithdrawalMethod.findOne({
      where: { userUuid, isDefault: true },
    });

    if (!defaultMethod) {
      return frontError(
        res,
        "No default withdrawal method found. Please add one."
      );
    }

    let methodToUse = defaultMethod;

    // If user provided a methodType, use it instead
    if (method) {
      const providedMethod = await WithdrawalMethod.findOne({
        where: { userUuid, methodType: method },
      });

      if (!providedMethod) {
        return frontError(res, "Specified withdrawal method not found.");
      }

      methodToUse = providedMethod;
    }

    // Check if the user was referred (i.e., has a referCode)
    // const user = await User.findOne({ where: { uuid: userUuid } });

    // if (user && user.referCode) {
    //   // Find the referrer using the referCode (username)
    //   const referrer = await User.findOne({ where: { username: user.referCode } });

    //   if (referrer) {
    //     // Get the referrer's total withdrawn amount
    //     const referrerWithdrawals = await Withdrawal.sum("amount", {
    //       where: {
    //         userUuid: referrer.uuid,
    //         status: "approved", // Only consider approved withdrawals
    //       },
    //     });

    //     // Fetch the referral withdrawal threshold from system settings
    //     const settings = await SystemSetting.findOne({ where: { key: 'referral_withdrawal_threshold' } });

    //     // Default to 100 if the setting doesn't exist
    //     const referralThreshold = settings ? settings.value : 100;

    //     // Check if the referrer has withdrawn enough (dynamic threshold)
    //     if (referrerWithdrawals < referralThreshold) {
    //       return frontError(res, `You cannot withdraw until your referrer has withdrawn ${referralThreshold} PKR.`);
    //     }
    //   } else {
    //     return frontError(res, "Referrer not found.");
    //   }
    // }

    // Get all eligible emails for withdrawal
    const availableEmails = await Email.findAll({
      where: { userUuid, status: "good", isWithdrawn: false },
    });

    const totalAmount = availableEmails.reduce(
      (sum, email) => sum + email.amount,
      0
    );

    if (totalAmount === 0) {
      return frontError(res, "No withdrawable amount found.");
    }

    //  Fetch the referral withdrawal threshold from system settings
    const settings = await SystemSetting.findOne({
      where: { key: "referral_withdrawal_threshold" },
    });

    // Default to 100 if the setting doesn't exist
    const referralThreshold = settings ? settings.value : 100;

    // Check if the referrer has withdrawn enough (dynamic threshold)
    // if (totalAmount < referralThreshold) {
    //   return frontError(res, `You cannot withdraw amount less than ${referralThreshold} PKR.`);
    // }

    // Create the withdrawal record using withdrawalMethodUuid
    const withdrawal = await Withdrawal.create({
      userUuid,
      withdrawalMethodUuid: methodToUse.uuid,
      amount: totalAmount,
    });

    // Mark emails as withdrawn
    await Email.update(
      { isWithdrawn: true },
      { where: { userUuid, status: "good", isWithdrawn: false } }
    );

    return successOkWithData(
      res,
      `Withdrawal of ₨${totalAmount} requested successfully.`,
      withdrawal
    );
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    return frontError(res, "Failed to request withdrawal.");
  }
}

export async function getMyWithdrawals(req, res) {
  try {
    const userUuid = req.userUid;
    const { status, startDate, endDate } = req.query;

    console.log("===== req.query ===== : ", req.query);

    // Build the filters
    let whereConditions = { userUuid };

    // Filter by status if provided
    if (status) {
      whereConditions.status = status; // e.g. "pending", "approved", "rejected"
    }

    // Filter by date range if startDate or endDate are provided
    if (startDate || endDate) {
      whereConditions.createdAt = {};
      if (startDate) {
        // Convert startDate to Date and reset time to midnight (start of day)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Reset time to 00:00:00
        whereConditions.createdAt[Op.gte] = start;
      }

      if (endDate) {
        // Convert endDate to Date and reset time to 23:59:59
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set time to 23:59:59
        whereConditions.createdAt[Op.lte] = end;
      }
    }

    console.log("===== whereConditions ===== : ", whereConditions);
    const withdrawals = await Withdrawal.findAll({
      where: whereConditions,
      include: [
        {
          model: WithdrawalMethod,
          as: "withdrawalMethod",
          attributes: ["methodType", "accountNumber"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return successOkWithData(res, "Your withdrawals fetched.", withdrawals);
  } catch (error) {
    return catchError(res, error);
  }
}

export async function getBonus(req, res) {
  try {
    const userUuid = req.userUid;

    const bonuses = await Bonus.findAll({
      where: {
        userUuid,
        type: ["signup", "referral"],
      },
    });

    // Extract the latest bonus of each type (if exists)
    const signupBonus = bonuses.find((b) => b.type === "signup");
    const referralBonus = bonuses.find((b) => b.type === "referral");

    return successOkWithData(res, "Bonus amounts fetched successfully.", {
      signup: signupBonus?.amount || 0,
      referral: referralBonus?.amount || 0,
    });
  } catch (error) {
    console.error("Error fetching bonuses:", error);
    return catchError(res, error);
  }
}

export async function requestBonusWithdrawal(req, res) {
  const userUuid = req.userUid;

  // ✅ Check if required fields are provided
  const reqBodyFields = bodyReqFields(req, res, ["bonusType"]);
  if (reqBodyFields.error) return reqBodyFields.response;

  const { bonusType } = req.body;

  // Validate bonusType
  if (!["signup", "referral"].includes(bonusType)) {
    return frontError(
      res,
      "Invalid bonus type. It must be 'signup' or 'referral'."
    );
  }

  try {
    // ✅ Fetch the bonus for the user based on the bonus type ('signup' or 'referral')
    const bonus = await Bonus.findOne({
      where: {
        userUuid: userUuid,
        type: bonusType,
      },
    });

    if (!bonus) {
      return validationError(
        res,
        `No ${
          bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } bonus available.`
      );
    }

    // ✅ Check if the bonus is unlocked after the first withdrawal
    if (!bonus.unlockedAfterFirstWithdrawal) {
      return validationError(
        res,
        `Your ${
          bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } bonus is locked until you make your first withdrawal.`
      );
    }

    // ✅ Create a new withdrawal request
    const withdrawalRequest = await BonusWithdrawal.create({
      bonusUuid: bonus.uuid,
      userUuid: userUuid,
      status: "pending", // Set status as pending initially
    });

    // ✅ Notify the user about the successful bonus withdrawal
    await createNotification({
      userUuid: userUuid,
      title: `${
        bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
      } Bonus Withdrawn`,
      message: `${
        bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
      } bonus has been successfully withdrawn.`,
      type: "success",
    });

    // ✅ Respond with success message and bonus amount
    return successOkWithData(
      res,
      `${
        bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
      } bonus withdrawal request created successfully.`,
      { bonusAmount: bonus.amount, withdrawalUuid: withdrawalRequest.uuid }
    );
  } catch (error) {
    console.error("Error processing bonus withdrawal:", error);
    return frontError(res, "Something went wrong. Please try again later.");
  }
}

// API to get Bonus Withdrawals
export async function getMyBonusWithdrawals(req, res) {
  try {
    const userUuid = req.userUid;

    const { status, startDate, endDate } = req.query;

    // Build the query filter object
    const queryFilter = { userUuid };

    // Filter by status if provided
    if (status && ["pending", "approved", "withdrawn"].includes(status)) {
      queryFilter.status = status;
    }

    // Filter by date range (start and end date) if provided
    // Filter by date range if startDate or endDate are provided
    if (startDate || endDate) {
      queryFilter.createdAt = {};
      if (startDate) {
        // Convert startDate to Date and reset time to midnight (start of day)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Reset time to 00:00:00
        queryFilter.createdAt[Op.gte] = start;
      }

      if (endDate) {
        // Convert endDate to Date and reset time to 23:59:59
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set time to 23:59:59
        queryFilter.createdAt[Op.lte] = end;
      }
    }

    // Fetch Bonus Withdrawals based on the query filter
    const bonusWithdrawals = await BonusWithdrawal.findAll({
      where: queryFilter,
      include: [
        {
          model: Bonus, // Assuming you're including Bonus details
          as: "bonus",
          attributes: ["uuid", "amount", "type"], // Adjust attributes as per need
        },
      ],
      order: [["createdAt", "DESC"]], // Ordering by creation date (desc)
    });

    if (!bonusWithdrawals || bonusWithdrawals.length === 0) {
      return frontError(
        res,
        "No bonus withdrawals found for the given criteria."
      );
    }

    // Return success response with the retrieved data
    return successOkWithData(
      res,
      "Bonus withdrawals retrieved successfully.",
      bonusWithdrawals
    );
  } catch (error) {
    console.error("Error fetching bonus withdrawals:", error);
    return frontError(res, "Something went wrong. Please try again later.");
  }
}
