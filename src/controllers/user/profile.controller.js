import Student from "../../models/user/user.model.js";
import {
  convertToLowercase,
  getRelativePath,
  validateCountryCode,
  validatePhone,
} from "../../utils/utils.js";
import {
  catchError,
  validationError,
  successOk,
  successOkWithData,
  UnauthorizedError,
  frontError,
  created,
  createdWithData,
} from "../../utils/responses.js";
import User from "../../models/user/user.model.js";
import Password from "../../models/password/password.model.js";
import Phone from "../../models/user/phone.model.js";
import { bodyReqFields } from "../../utils/requiredFields.js";
import { Op } from "sequelize";

// ========================= Get Profile ============================

export async function getProfile(req, res) {
  try {
    const userUid = req.userUid;

    let profile = await User.findByPk(userUid, {
      attributes: {
        exclude: ["password", "createdAt", "updatedAt"],
      },
      // attributes: [
      //   "uuid",
      //   "firstName",
      //   "lastName",
      //   "email",
      //   "countryCode",
      //   "phone",
      //   "dateOfBirth",
      //   "cnic",
      //   "gender",
      //   "education",
      //   "experience",
      //   "address",
      //   "tehsil",
      //   "district",
      //   "province",
      //   "profileImg",
      // ],
    });
    if (!profile) return UnauthorizedError(res, "Invalid token");

    // assign password
    if (profile.passwordUuid === null) {
      // Get active passwords
      const passwords = await Password.findAll({
        where: { active: true },
        order: [["uuid", "ASC"]],
      });

      // If no active passwords are available, return the profile as is
      if (passwords.length === 0) {
        return successOkWithData(res, "Profile fetched successfully", profile);
      }

      // Assign a password in a round-robin manner
      const userCount = await User.count();
      const passwordIndex = userCount % passwords.length;
      await User.update(
        { passwordUuid: passwords[passwordIndex].uuid },
        { where: { uuid: userUid } }
      );
    }

    // Fetch the updated profile to reflect the assigned passwordUuid
    profile = await User.findByPk(userUid, {
      attributes: {
        exclude: ["password", "createdAt", "updatedAt"],
      },
    });

    return successOkWithData(res, "Profile fetched successfully", profile);
  } catch (error) {
    return catchError(res, error);
  }
}

// ========================= Update Profile ============================

export async function updateProfile(req, res) {
  try {
    const userUid = req.userUid;

    const {
      firstName,
      lastName,
      countryCode,
      phone,
      gender,
      dateOfBirth,
      cnic,
      education,
      experience,
      address,
      tehsil,
      district,
      province,
    } = req.body;

    let fieldsToUpdate = {};

    // If countryCode is updated, ensure that phoneNo is also provided
    // if (countryCode && !phone) return validationError(res, "Phone number must be provided when changing the country code.");

    // if (firstName) fieldsToUpdate.firstName = firstName;
    // if (lastName) fieldsToUpdate.lastName = lastName;

    // Validate phone number if provided
    // if (phone) {
    //   // ✅ Validate Phone Number
    //   const phoneError = validatePhone(phone);
    //   if (phoneError) return validationError(res, phoneError, "phone");
    //   fieldsToUpdate.phone = phone;
    // }

    // Validate country code if provided
    // if (countryCode) {
    //   // ✅ Validate Country Code
    //   const countryCodeError = validateCountryCode(countryCode);
    //   if (countryCodeError) return validationError(res, countryCodeError, "countryCode");
    //   fieldsToUpdate.countryCode = countryCode;
    // }

    // If profileImg is provided, handle the upload
    if (req.file) {
      const profileImgPath = getRelativePath(req.file.path); // Get the relative path for the image
      fieldsToUpdate.profileImg = profileImgPath; // Add the profileImg path to the update fields
    }

    const excludedFields = ["profileImg"];
    const fieldsToUpdateLowered = convertToLowercase(
      fieldsToUpdate,
      excludedFields
    );

    console.log(" ===== fieldsToUpdate ===== ", fieldsToUpdate);
    console.log(" ===== fieldsToUpdateLowered ===== ", fieldsToUpdateLowered);
    await User.update(fieldsToUpdate, {
      where: { uuid: userUid },
    });

    return successOk(res, "Profile updated successfully.");
  } catch (error) {
    return catchError(res, error);
  }
}

// ========================= Get Other Phones ============================

// Get other phones for a user
export async function getPhones(req, res) {
  try {
    const userUid = req.userUid;

    const phones = await Phone.findAll({
      where: { userUuid: userUid },
      order: [["createdAt", "DESC"]],
    });

    return successOkWithData(res, "Phones fetched successfully.", phones);
  } catch (error) {
    console.error("Get User Phones Error:", error);
    return catchError(res, error);
  }
}

// ========================= Bulk Add Phones ============================

// Add multiple phone numbers for a user
export async function bulkAddPhones(req, res) {
  try {
    const userUid = req.userUid;

    const reqBodyFields = bodyReqFields(req, res, ["phones"]);
    if (reqBodyFields.error) return reqBodyFields.response;

    let { phones } = req.body; // Expecting an array of phones
    if (!Array.isArray(phones) || phones.length === 0) {
      return validationError(res, "Phones must be a non-empty array.");
    }

    const user = await User.findByPk(userUid);
    if (!user) return frontError(res, "Invalid uuid.");

    // Extract all countryCode+phone combinations
    const fullNumbersMap = phones.map((p) => ({
      full: `${p.countryCode}${p.phone}`,
      countryCode: p.countryCode,
      phone: p.phone,
    }));

    // Query existing numbers
    const existingPhones = await Phone.findAll({
      where: {
        [Op.or]: fullNumbersMap.map((p) => ({
          countryCode: p.countryCode,
          phone: p.phone,
        })),
      },
    });

    const existingFullNumbers = existingPhones.map(
      (p) => `${p.countryCode}${p.phone}`
    );

    // Validate and collect valid phones
    const validPhones = [];
    const invalidPhones = [];
    const phonesToInsert = [];

    for (const p of phones) {
      if (!p.countryCode || !p.phone)
        return validationError(res, "Both phone and countryCode are required.");

      const fullNumber = `${p.countryCode}${p.phone}`;
      if (existingFullNumbers.includes(fullNumber)) {
        invalidPhones.push(`${fullNumber} already exists.`);
        continue;
      }

      const error = validatePhone(p.phone);
      if (error) {
        invalidPhones.push(`${fullNumber} is invalid: ${error}.`);
      } else {
        validPhones.push(fullNumber);
        phonesToInsert.push({
          userUuid: userUid,
          countryCode: p.countryCode,
          phone: p.phone,
        });
      }
    }

    if (phonesToInsert.length === 0) {
      return validationError(
        res,
        `No valid phone numbers found. Invalid entries: ${invalidPhones.join(
          " ----- "
        )}`
      );
    }

    await Phone.bulkCreate(phonesToInsert);

    return createdWithData(res, "Phones added successfully.", {
      added: validPhones,
      invalid: invalidPhones.length > 0 ? invalidPhones : undefined,
    });
  } catch (error) {
    console.error("Bulk Add Phones Error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}
