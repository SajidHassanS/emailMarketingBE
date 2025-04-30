import { Op } from "sequelize";
import models from "../../models/models.js";
import {
  catchError,
  frontError,
  successOkWithData,
  validationError,
} from "../../utils/responses.js";
import { bodyReqFields } from "../../utils/requiredFields.js";
const {
  Email,
  Withdrawal,
  WithdrawalMethod,
  Bonus,
  BonusWithdrawal,
  SystemSetting,
} = models;
import { createNotification } from "../notification/notification.controller.js";

// Get Available Balance for the User
// export async function getAvailableBalance(req, res) {
//   try {
//     const userUuid = req.userUid;

//     // // Get all emails that are marked "good" and are not withdrawn yet
//     // const emails = await Email.findAll({
//     //   where: { userUuid, status: "good", isWithdrawn: false },
//     //   attributes: ["amount"], // Only fetch the 'amount' column
//     // });

//     // const totalAmount = emails.reduce((sum, e) => sum + e.amount, 0);

//     // return successOkWithData(res, "Available balance fetched successfully.", {
//     //   balance: totalAmount,
//     // });

//     // Get unwithdrawn "good" emails (positive earnings)
//     const unwithdrawnEmails = await Email.findAll({
//       where: { userUuid, status: "good", isWithdrawn: false },
//       attributes: ["amount"],
//     });

//     // Get withdrawn emails with negative amounts (penalties)
//     const withdrawnNegativeEmails = await Email.findAll({
//       where: {
//         userUuid,
//         isWithdrawn: true,
//         amount: { [Op.lt]: 0 },
//       },
//       attributes: ["amount"],
//     });

//     // Sum unwithdrawn positive amounts
//     const positiveTotal = unwithdrawnEmails.reduce((sum, e) => sum + e.amount, 0);

//     // Sum withdrawn negative amounts
//     const negativeTotal = withdrawnNegativeEmails.reduce((sum, e) => sum + e.amount, 0);

//     // Total balance includes both
//     const availableBalance = positiveTotal + negativeTotal;

//     return successOkWithData(res, "Available balance fetched successfully.", {
//       balance: availableBalance,
//     });
//   } catch (error) {
//     console.log("Error fetching balance:", error);
//     return catchError(res, error);
//   }
// }

// Get Available Balance for the User
export async function getAvailableBalance(req, res) {
  try {
    const userUuid = req.userUid;

    // Fetch all emails for this user
    const emails = await Email.findAll({
      where: { userUuid },
      attributes: ["amount", "status", "isWithdrawn"],
    });

    let availableBalance = 0;

    for (const email of emails) {
      if (email.status === "good" && !email.isWithdrawn) {
        // Positive earnings (not yet withdrawn)
        availableBalance += email.amount;
      } else if (email.isWithdrawn && email.amount < 0) {
        // Negative penalties after withdrawal
        availableBalance += email.amount;
      }
      // ❗ All other cases (bad, pending, etc.) don't affect balance
    }

    return successOkWithData(res, "Available balance fetched successfully.", {
      balance: availableBalance,
    });
  } catch (error) {
    console.log("Error fetching balance:", error);
    return catchError(res, error);
  }
}


// Request a withdrawal
// export async function requestWithdrawal(req, res) {
//   try {
//     const userUuid = req.userUid;

//     const reqBodyFields = bodyReqFields(req, res, [
//       "method",
//     ]);
//     if (reqBodyFields.error) return reqBodyFields.response;

//     const { method } = req.body;

//     // // Fetch user's default withdrawal method
//     // const defaultMethod = await WithdrawalMethod.findOne({
//     //   where: { userUuid, isDefault: true },
//     // });

//     // if (!defaultMethod) {
//     //   return frontError(
//     //     res,
//     //     "No default withdrawal method found. Please add one."
//     //   );
//     // }

//     // let methodToUse = defaultMethod;

//     // If user provided a methodType, use it instead
//     // if (method) {
//     //   const providedMethod = await WithdrawalMethod.findOne({
//     //     where: { userUuid, methodType: method },
//     //   });

//     //   if (!providedMethod) {
//     //     return frontError(res, "Specified withdrawal method not found.");
//     //   }

//     //   methodToUse = providedMethod;
//     // }

//     const providedMethod = await WithdrawalMethod.findOne({
//       where: { userUuid, methodType: method },
//     });

//     if (!providedMethod) {
//       return frontError(res, "Invalid withdrwal method.", "method");
//     }

//     const methodToUse = providedMethod;

//     // // Get all eligible emails for withdrawal
//     // const availableEmails = await Email.findAll({
//     //   where: { userUuid, status: "good", isWithdrawn: false },
//     // });

//     // const totalAmount = availableEmails.reduce(
//     //   (sum, email) => sum + email.amount,
//     //   0
//     // );

//     // Get unwithdrawn "good" emails (positive earnings)
//     const unwithdrawnEmails = await Email.findAll({
//       where: { userUuid, status: "good", isWithdrawn: false },
//     });

//     // Get withdrawn emails with negative amounts (penalties)
//     const withdrawnNegativeEmails = await Email.findAll({
//       where: {
//         userUuid,
//         isWithdrawn: true,
//         amount: { [Op.lt]: 0 },
//       },
//     });

//     const positiveTotal = unwithdrawnEmails.reduce((sum, e) => sum + e.amount, 0);
//     const negativeTotal = withdrawnNegativeEmails.reduce((sum, e) => sum + e.amount, 0);

//     const totalAmount = positiveTotal + negativeTotal;

//     if (totalAmount <= 0) {
//       return frontError(res, "No withdrawable amount found.");
//     }

//     //  Fetch the referral withdrawal threshold from system settings
//     const settings = await SystemSetting.findOne({
//       where: { key: "referral_withdrawal_threshold" },
//     });

//     // Default to 100 if the setting doesn't exist
//     // const referralThreshold = settings ? settings.value : 100;
//     const referralThreshold = 10;

//     // Check if the referrer has withdrawn enough (dynamic threshold)
//     if (totalAmount < referralThreshold) {
//       return frontError(
//         res,
//         `You cannot withdraw amount less than ${referralThreshold} PKR.`
//       );
//     }

//     // Create the withdrawal record using withdrawalMethodUuid
//     const withdrawal = await Withdrawal.create({
//       userUuid,
//       withdrawalMethodUuid: methodToUse.uuid,
//       amount: totalAmount,
//     });

//     // Mark emails as withdrawn
//     await Email.update(
//       { isWithdrawn: true },
//       { where: { userUuid, status: "good", isWithdrawn: false } }
//     );

//     return successOkWithData(
//       res,
//       `Withdrawal of ₨${totalAmount} requested successfully.`,
//       withdrawal
//     );
//   } catch (error) {
//     console.error("Error requesting withdrawal:", error);
//     return frontError(res, "Failed to request withdrawal.");
//   }
// }

export async function requestWithdrawal(req, res) {
  try {
    const userUuid = req.userUid;

    // Validate body fields
    const reqBodyFields = bodyReqFields(req, res, ["method"]);
    if (reqBodyFields.error) return reqBodyFields.response;

    const { method } = req.body;

    // Fetch the specified withdrawal method
    const methodToUse = await WithdrawalMethod.findOne({
      where: { userUuid, methodType: method },
    });

    if (!methodToUse) {
      return frontError(res, "Invalid withdrawal method.", "method");
    }

    // Fetch all relevant emails:
    // 1. "good" and not yet withdrawn (positive earnings)
    // 2. Already withdrawn but negative amounts (penalties)
    const emails = await Email.findAll({
      where: {
        userUuid,
        [Op.or]: [
          { status: "good", isWithdrawn: false },
          { isWithdrawn: true, amount: { [Op.lt]: 0 } },
        ],
      },
    });

    if (emails.length === 0) {
      return frontError(res, "No withdrawable amount found.");
    }

    // Calculate totals
    let positiveTotal = 0;
    let negativeTotal = 0;

    for (const email of emails) {
      if (email.status === "good" && !email.isWithdrawn) {
        positiveTotal += email.amount;
      } else if (email.isWithdrawn && email.amount < 0) {
        negativeTotal += email.amount;
      }
    }

    const totalAmount = positiveTotal + negativeTotal;

    if (totalAmount <= 0) {
      return frontError(res, "No withdrawable amount found.");
    }

    // Fetch withdrawal threshold
    const settings = await SystemSetting.findOne({
      where: { key: "referral_withdrawal_threshold" },
    });

    const referralThreshold = settings ? Number(settings.value) : 100; // fallback 100 PKR

    if (totalAmount < referralThreshold) {
      return frontError(
        res,
        `You cannot withdraw an amount less than ${referralThreshold} PKR.`
      );
    }

    // Create withdrawal record
    const withdrawal = await Withdrawal.create({
      userUuid,
      withdrawalMethodUuid: methodToUse.uuid,
      amount: totalAmount,
    });

    // Send notification to user
    await createNotification({
      userUuid,
      title: 'Withdrawal Requested',
      message: `Your withdrawal request of ₨${totalAmount} has been received. We will process it shortly.`,
      type: "info", // or "action_required", depending on your frontend handling
    });

    // Mark all "good" and not withdrawn emails as withdrawn
    await Email.update(
      { isWithdrawn: true },
      {
        where: {
          userUuid,
          status: "good",
          isWithdrawn: false,
        },
      }
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
      include: [
        {
          model: BonusWithdrawal,
          as: "withdrawals",
          required: false,
        },
      ],
    });


    // Create a Set to track processed bonus_uuid (so we don't process the same bonus multiple times)
    const processedBonusUuids = new Set();

    // Filter out bonuses where the withdrawal has been approved, and only count one rejection
    const availableBonuses = bonuses.filter(bonus => {
      // Skip the bonus if we have already processed it
      if (processedBonusUuids.has(bonus.uuid)) {
        return false;
      }

      // If the bonus has no withdrawals, it's available
      if (!bonus.withdrawals || bonus.withdrawals.length === 0) return true;

      // Track if this bonus has been approved (if so, this bonus should not be included)
      const hasApprovedWithdrawal = bonus.withdrawals.some(withdrawal => withdrawal.status === 'approved');

      if (hasApprovedWithdrawal) {
        // If there's an approved withdrawal, exclude this bonus completely
        processedBonusUuids.add(bonus.uuid); // Mark as processed
        return false;
      }

      // Track if this bonus has any rejected withdrawals
      const hasRejectedWithdrawal = bonus.withdrawals.some(withdrawal => withdrawal.status === 'rejected');

      // If we found a rejected withdrawal and it hasn't been processed yet, include this bonus
      if (hasRejectedWithdrawal) {
        processedBonusUuids.add(bonus.uuid); // Mark as processed
        return true;
      }

      return false;
    });

    // Find the available bonuses by type
    const signupBonus = availableBonuses.find(b => b.type === "signup");
    const referralBonus = availableBonuses.find(b => b.type === "referral");

    // Return the result
    return successOkWithData(res, "Bonus amounts fetched successfully.", {
      signup: signupBonus ? signupBonus.amount : 0,
      referral: referralBonus ? referralBonus.amount : 0,
    });
  } catch (error) {
    console.error("Error fetching bonuses:", error);
    return catchError(res, error);
  }
}

export async function requestBonusWithdrawal(req, res) {
  const userUuid = req.userUid;

  // ✅ Check if required fields are provided
  const reqBodyFields = bodyReqFields(req, res, ["bonusType", "method"]);
  if (reqBodyFields.error) return reqBodyFields.response;

  const { bonusType, method } = req.body; // Optional: methodType to override default

  // Fetch user's default withdrawal method
  // const defaultMethod = await WithdrawalMethod.findOne({
  //   where: { userUuid, isDefault: true },
  // });

  // if (!defaultMethod) {
  //   return frontError(
  //     res,
  //     "No default withdrawal method found. Please add one."
  //   );
  // }

  // let methodToUse = defaultMethod;

  // // If user provided a methodType, use it instead
  // if (method) {
  //   const providedMethod = await WithdrawalMethod.findOne({
  //     where: { userUuid, methodType: method },
  //   });

  //   if (!providedMethod) {
  //     return frontError(res, "Specified withdrawal method not found.");
  //   }

  //   methodToUse = providedMethod;
  // }

  const providedMethod = await WithdrawalMethod.findOne({
    where: { userUuid, methodType: method },
  });

  if (!providedMethod) {
    return frontError(res, "Invalid withdrwal method.", "method");
  }

  const methodToUse = providedMethod;

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
        `No ${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } bonus available.`
      );
    }

    // ✅ Check if the bonus is unlocked after the first withdrawal
    if (!bonus.unlockedAfterFirstWithdrawal) {
      return validationError(
        res,
        `Your ${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } bonus is locked until you make your first withdrawal.`
      );
    }

    // ✅ Check if a withdrawal request for the same bonus already exists
    const existingRequest = await BonusWithdrawal.findOne({
      where: {
        bonusUuid: bonus.uuid,
        userUuid: userUuid,
        status: "pending", // Optionally check only 'pending' requests
      },
    });

    if (existingRequest) {
      return validationError(
        res,
        `You have already created a withdrawal request for this ${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } bonus.`
      );
    }

    // ✅ Create a new withdrawal request
    const withdrawalRequest = await BonusWithdrawal.create({
      bonusUuid: bonus.uuid,
      userUuid: userUuid,
      withdrawalMethodUuid: methodToUse.uuid,
      status: "pending", // Set status as pending initially
    });

    // ✅ Notify the user about the successful bonus withdrawal
    await createNotification({
      userUuid: userUuid,
      title: `${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } Bonus Withdrawn`,
      message: `${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
        } bonus has been successfully withdrawn.`,
      type: "success",
    });

    // ✅ Respond with success message and bonus amount
    return successOkWithData(
      res,
      `${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)
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
