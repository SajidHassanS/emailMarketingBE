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
import { convertToLowercase } from "../../utils/utils.js";
import models from "../../models/models.js";
import { validatePassword } from "../../utils/passwordUtils.js";
import { uniqueNamesGenerator, names } from "unique-names-generator"; // Generates realistic names
const { Password, User } = models

// ========================= Get All Projects ============================

export async function getUniqueNameAndPassword(req, res) {
  try {
    const userUid = req.userUid

    // ✅ Generate a realistic name
    const firstName = uniqueNamesGenerator({ dictionaries: [names], length: 1 });
    const lastName = uniqueNamesGenerator({ dictionaries: [names], length: 1 });
    const name = `${firstName} ${lastName}`; // Example: JohnSmith456

    // ✅ Fetch assigned password to user
    const user = await User.findOne({
      where: { uuid: userUid },
      attributes: ["uuid", "password_uuid"],
      include: {
        model: Password,
        attributes: ["password", "active"],
        where: { active: true }
      }
    });

    if (!user || !user.Password) return notFound(res, "No active password found for this user.")

    return successOkWithData(res, "Unique name and password retrieved successfully.", {
      name,
      password: user.Password.password
    });
  } catch (error) {
    return catchError(res, error);
  }
}