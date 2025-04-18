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
} from "../../utils/responses.js";
import User from "../../models/user/user.model.js";
import Password from "../../models/password/password.model.js";

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
