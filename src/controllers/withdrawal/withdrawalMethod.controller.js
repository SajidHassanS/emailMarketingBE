import models from "../../models/models.js";
import {
  catchError,
  frontError,
  successOk,
  successOkWithData,
} from "../../utils/responses.js"; // Custom response handlers
const { WithdrawalMethod } = models;
import { bodyReqFields, queryReqFields } from "../../utils/requiredFields.js"; // Custom request body field validation

// Get all withdrawal methods for the user
export async function getWithdrawalMethods(req, res) {
  try {
    const userUuid = req.userUid;

    // Fetch all withdrawal methods for the user
    const withdrawalMethods = await WithdrawalMethod.findAll({
      where: { userUuid },
    });

    if (!withdrawalMethods || withdrawalMethods.length === 0) {
      return frontError(res, "No withdrawal methods found for this user.");
    }

    return successOkWithData(
      res,
      "Withdrawal methods fetched successfully.",
      withdrawalMethods
    );
  } catch (error) {
    console.log("Error fetching withdrawal methods:", error);
    return catchError(res, error);
  }
}

// Add a new withdrawal method
export async function addWithdrawalMethod(req, res) {
  try {
    const userUuid = req.userUid;

    const reqBodyFields = bodyReqFields(req, res, [
      "methodType",
      "accountNumber",
      "accountTitle",
    ]);
    if (reqBodyFields.error) return reqBodyFields.response;

    const { methodType, accountNumber, accountTitle, markDefault } = req.body;

    if (!["easypaisa", "jazzcash", "bank"].includes(methodType)) {
      return frontError(res, "Invalid method type.");
    }

    // Check if the withdrawal method already exists for the user
    const existingMethod = await WithdrawalMethod.findOne({
      where: { userUuid, methodType, accountNumber },
    });

    if (existingMethod) {
      return frontError(
        res,
        `The ${methodType} withdrawal method already exists.`
      );
    }

    // Create the withdrawal method
    const withdrawalMethod = await WithdrawalMethod.create({
      userUuid,
      methodType,
      accountNumber,
      accountTitle: accountTitle || null, // Optional for mobile wallets
    });

    return successOk(
      res,
      "Withdrawal method added successfully.",
      withdrawalMethod
    );
  } catch (error) {
    console.log("Error adding withdrawal method:", error);
    return catchError(res, error);
  }
}

// Update an existing withdrawal method (e.g., account number or title change)
// export async function updateWithdrawalMethod(req, res) {
//   try {
//     const userUuid = req.userUid;

//     const reqQueryFields = queryReqFields(req, res, ["uuid"]);
//     if (reqQueryFields.error) return reqQueryFields.response;

//     const { uuid } = req.query;

//     const { methodType, accountNumber, accountTitle } = req.body;

//     const withdrawalMethod = await WithdrawalMethod.findOne({
//       where: { uuid, userUuid },
//     });

//     if (!withdrawalMethod) {
//       return frontError(res, "Withdrawal method not found.");
//     }

//     // Update the withdrawal method
//     withdrawalMethod.methodType = methodType || withdrawalMethod.methodType;
//     withdrawalMethod.accountNumber =
//       accountNumber || withdrawalMethod.accountNumber;
//     withdrawalMethod.accountTitle =
//       accountTitle || withdrawalMethod.accountTitle;

//     await withdrawalMethod.save();

//     return successOk(
//       res,
//       "Withdrawal method updated successfully.",
//       withdrawalMethod
//     );
//   } catch (error) {
//     console.log("Error updating withdrawal method:", error);
//     return catchError(res, error);
//   }
// }

// Set a withdrawal method as default
export async function setDefaultWithdrawalMethod(req, res) {
  try {
    const userUuid = req.userUid;

    const reqQueryFields = queryReqFields(req, res, ["uuid"]);
    if (reqQueryFields.error) return reqQueryFields.response;

    const { uuid } = req.query;

    // Reset any existing default method for this user
    await WithdrawalMethod.update(
      { isDefault: false },
      { where: { userUuid, isDefault: true } }
    );

    // Set the new default method
    const withdrawalMethod = await WithdrawalMethod.findOne({
      where: { uuid, userUuid },
    });

    if (!withdrawalMethod) {
      return frontError(res, "Withdrawal method not found.");
    }

    withdrawalMethod.isDefault = true;
    await withdrawalMethod.save();

    return successOk(
      res,
      `${withdrawalMethod.methodType.toUpperCase()} is successfully set default withdrawal method.`
    );
  } catch (error) {
    console.log("Error setting default withdrawal method:", error);
    return catchError(res, error);
  }
}
