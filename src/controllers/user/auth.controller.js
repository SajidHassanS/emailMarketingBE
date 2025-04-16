// import crypto from "crypto";
import { Sequelize } from "sequelize";
// import BlacklistToken from "../../models/user/blackListToken.model.js";
// import jwt from "jsonwebtoken";
// import Student from "../../models/user/user.model.js"; // Updated to reflect the new model
import { bodyReqFields } from "../../utils/requiredFields.js";
import {
  convertToLowercase,
  validateCountryCode,
  validateEmail,
  validatePhone,
  validateUsername,
} from "../../utils/utils.js";
import {
  comparePassword,
  hashPassword,
  validatePassword,
} from "../../utils/passwordUtils.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  // verifyRefreshToken,
} from "../../utils/jwtTokenGenerator.js";
// import { sendOTPEmail } from "../../utils/sendEmailUtils.js";
import {
  created,
  frontError,
  catchError,
  validationError,
  successOk,
  successOkWithData,
  UnauthorizedError,
  sequelizeValidationError,
  forbiddenError,
  notFound,
} from "../../utils/responses.js";
// import User from "../../models/user/user.model.js";
import { jwtSecret } from "../../config/initialConfig.js";
import jwt from "jsonwebtoken";
// import BlacklistToken from "../../models/user/blackListToken.model.js";
// import Password from "../../models/password/password.model.js";
import models from "../../models/models.js";
<<<<<<< Updated upstream
import { createNotification } from "../notification/notification.controller.js";
const { User, BlacklistToken, Password, Bonus, SystemSetting } = models
=======
import SystemSetting from "../../models/systemSetting/systemSetting.model.js";
import Bonus from "../../models/bonus/bonus.model.js";
import { createNotification } from "../notification/notification.controller.js";
const { User, BlacklistToken, Password } = models;
>>>>>>> Stashed changes

// ========================= Register User ============================

export async function registerUser(req, res) {
  try {
    // ✅ Check if required fields are provided
    const reqBodyFields = bodyReqFields(req, res, [
      "username",
      "countryCode",
      "phone",
      "password",
      "confirmPassword",
    ]);
    if (reqBodyFields.error) return reqBodyFields.response;

    // ✅ Convert relevant fields to lowercase (excluding sensitive ones)
    const excludedFields = [
      "countryCode",
      "phone",
      "password",
      "confirmPassword",
    ];
    const requiredData = convertToLowercase(req.body, excludedFields);
    let { countryCode, phone, password, confirmPassword } = requiredData;
    let { username, referCode } = req.body; // use this referCode is case sensitive

    // ✅ Validate User Name
    const usernameError = validateUsername(username);
    if (usernameError) return validationError(res, usernameError, "username");

    // ✅ Validate Country Code
    const countryCodeError = validateCountryCode(countryCode);
    if (countryCodeError)
      return validationError(res, countryCodeError, "countryCode");

    // ✅ Validate Phone Number
    const phoneError = validatePhone(phone);
    if (phoneError) return validationError(res, phoneError, "phone");

    // ✅ Check if the Email Already Exists
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser)
      return validationError(res, "This phone is already registered.", "phone");

    // ✅ Check if Passwords Match (Explicitly Checking Here)
    if (password !== confirmPassword) {
      return validationError(res, "Passwords do not match.", "password");
    }

    // ✅ Validate Password Format
    const invalidPassword = validatePassword(password);
    if (invalidPassword) return validationError(res, invalidPassword);

    // ✅ Hash Password Before Saving
    const hashedPassword = await hashPassword(password);

    // Get active passwords
    const passwords = await Password.findAll({
      where: { active: true },
      order: [["uuid", "ASC"]],
    });

    // Count existing users to determine which password to assign
    const userCount = await User.count();
    const passwordIndex = userCount % passwords.length; // Round-robin assignment

    // ✅ If referCode is provided, check if it exists in the User table
    let referUser = null;
    if (referCode) {
      referUser = await User.findOne({ where: { username: referCode } });
    }

    let userData = {};
    // ✅ Prepare Data for Insertion
    userData.username = username;
    userData.phone = phone;
    userData.countryCode = countryCode;
    userData.password = hashedPassword;
    if (referUser) userData.referCode = referCode; // Assign referCode only if referCode is valid
    // userData.bonus = 0 // get bonus set by admin | not needed any more
    userData.active = false;
    if (passwords.length !== 0)
      userData.passwordUuid = passwords[passwordIndex].uuid; // assign password for email generation

    console.log("===== userData ===== : ", userData);

    // ✅ Create New User in Database
    const newUser = await User.create(userData);

    // ✅ Add Signup Bonus
    const signupBonus = await SystemSetting.findOne({
      where: { key: "default_signup_bonus" },
    });
    if (signupBonus) {
      await Bonus.create({
        userUuid: newUser.uuid,
        type: "signup",
        amount: parseInt(signupBonus.value),
        status: "pending",
      });
    }

    // ✅ Add Referral Bonus (to the referring user, if applicable)
    let referralBonusStatus = ""; // To store message about referral bonus status
    if (referCode && referUser) {
      const referralBonus = await SystemSetting.findOne({
        where: { key: "default_referral_bonus" },
      });
      if (referralBonus) {
        await Bonus.create({
          userUuid: referUser.uuid,
          type: "referral",
          amount: parseInt(referralBonus.value),
          status: "pending",
          refereeUuid: newUser.uuid, // Storing the refereeUuid (new user who used the referral code)
        });
        referralBonusStatus = "Referral bonus awarded successfully.";
      } else {
        referralBonusStatus =
          "No referral bonus awarded. Please contact admin for more details.";
      }
    }

    // ✅ Create a Welcome Notification for the New User
    const notificationMessage = `Welcome ${newUser.username}! Your account has been successfully created. ${referralBonusStatus}`;
    await createNotification({
      userUuid: newUser.uuid,
      title: "Welcome to the Platform",
      message: notificationMessage,
      type: "info",
    });

    // Send response with appropriate messages
    if (referCode && referUser) {
      return created(res, "User profile created successfully.");
    } else if (referCode && !referUser) {
      return created(
        res,
        "User profile created successfully, but the provided referCode is invalid."
      );
    } else {
      return created(res, "User profile created successfully.");
    }
  } catch (error) {
    console.log(error);

    // ✅ Handle Sequelize Validation Errors
    if (error instanceof Sequelize.ValidationError) {
      return sequelizeValidationError(res, error);
    }
    // ✅ Catch Any Other Errors
    return catchError(res, error);
  }
}

// ========================= Login User ============================

export async function loginUser(req, res) {
  try {
    const reqBodyFields = bodyReqFields(req, res, ["username", "password"]);
    if (reqBodyFields.error) return reqBodyFields.response;

    const { username, password } = req.body;

    // Check if a user with the given email not exists
    const user = await User.findOne({ where: { username } });
    if (!user) return validationError(res, "Invalid username or password");

    // Check if the account is inactive
    if (!user.active) {
      return validationError(
        res,
        "Your account is not approved yet. Please contact the admin."
      );
    }

    // Compare passwords
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return validationError(res, "Invalid username or password");

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // If passwords match, return success
    return successOkWithData(res, "Login successful", {
      accessToken,
      refreshToken,
    });
  } catch (error) {
    return catchError(res, error);
  }
}

// ========================= Regenerate Access Token ============================

export async function regenerateAccessToken(req, res) {
  try {
    const reqBodyFields = bodyReqFields(req, res, ["refreshToken"]);
    if (reqBodyFields.error) return reqBodyFields.response;

    const { refreshToken } = req.body;
    const { invalid, expired, userUid } = verifyRefreshToken(refreshToken);

    // Check if a user with the given uuid not exists
    const user = await User.findOne({ where: { uuid: userUid } });
    if (!user) return validationError(res, "Invalid token.");

    if (invalid) return validationError(res, "Invalid refresh token");
    if (expired)
      return forbiddenError(
        res,
        "Refresh token has expired. Please log in again."
      );

    const newAccessToken = generateAccessToken({ uuid: userUid });

    return successOkWithData(res, "Access Token Generated Successfully", {
      accessToken: newAccessToken,
    });
  } catch (error) {
    return catchError(res, error);
  }
}

// ========================= Update Password ============================

export async function updatePassword(req, res) {
  try {
    const userUid = req.userUid;
    const reqBodyFields = bodyReqFields(req, res, [
      "oldPassword",
      "newPassword",
      "confirmPassword",
    ]);
    if (reqBodyFields.error) return reqBodyFields.response;

    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Check if a user exists
    const user = await User.findOne({ where: { uuid: userUid } });
    if (!user) return UnauthorizedError(res, "Invalid token");

    // Compare oldPassword with hashed password in database
    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch)
      return validationError(res, "Invalid old password", "oldPassword");

    const invalidPassword = validatePassword(newPassword, confirmPassword);
    if (invalidPassword) return validationError(res, invalidPassword);

    // Check if oldPassword and newPassword are the same
    if (oldPassword === newPassword)
      return validationError(
        res,
        "New password must be different from old password"
      );

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    // // Update user's password in the database
    await user.update({ password: hashedPassword });

    return successOk(res, "Password updated successfully.");
  } catch (error) {
    console.log(error);
    catchError(res, error);
  }
}

// // ========================= Forgot Password ============================
// export async function forgotPassword(req, res) {
//   try {
//     const reqBodyFields = bodyReqFields(req, res, ["email"]);
//     if (reqBodyFields.error) return reqBodyFields.response;

//     const { email } = req.body;

//     // Check if a user with the given email exists
//     const user = await Student.findOne({ where: { email } });
//     if (!user) return validationError(res, "This email is not registered.", "email");

//     // generating otp
//     const otp = crypto.randomInt(100099, 999990);

//     // Save OTP in the database within transaction
//     await Student.update({ otp, otpCount: 0 }, { where: { email } });

//     // Send OTP email
//     const emailSent = await sendOTPEmail(email, otp);

//     if (!emailSent) return catchError(res, "Something went wrong. Failed to send OTP.");

//     return successOk(res, "OTP sent successfully");
//   } catch (error) {
//     return catchError(res, error);
//   }
// }

// // ========================= Verify OTP ============================

// export async function verifyOtp(req, res) {
//   try {
//     const reqBodyFields = bodyReqFields(req, res, ["email", "otp"]);
//     if (reqBodyFields.error) return reqBodyFields.response;
//     const { email, otp } = req.body;

//     // Check if a user with the given email exists
//     const user = await Student.findOne({ where: { email } });
//     if (!user) return frontError(res, "This email is not registered.", "email");

//     if (user.otpCount >= 3) return validationError(res, "Maximum OTP attempts reached. Please regenerate OTP.");

//     // Compare OTP; if incorrect, increment otp_count
//     if (user.otp !== parseInt(otp, 10)) {
//       await user.update({ otpCount: user.otpCount + 1 });
//       return validationError(res, "Invalid OTP");
//     }

//     // OTP matched, reset otp_count and set can_change_password to true
//     await user.update({ otpCount: 0, canChangePassword: true });

//     return successOk(res, "OTP Verified Successfully");
//   } catch (error) {
//     return catchError(res, error);
//   }
// }

// // ========================= Set New Password ============================

// export async function setNewPassword(req, res) {
//   try {
//     const reqBodyFields = bodyReqFields(req, res, [
//       "newPassword",
//       "confirmPassword",
//       "email",
//     ]);
//     if (reqBodyFields.error) return reqBodyFields.response;

//     const { newPassword, confirmPassword, email } = req.body;

//     // Check if a user with the given email exists
//     const user = await Student.findOne({ where: { email } });
//     if (!user) return frontError(res, "User not found");

//     // Check if passwords match
//     const invalidPassword = validatePassword(newPassword, confirmPassword);
//     if (invalidPassword) return validationError(res, invalidPassword);

//     // Only allow if canChangePassword is true (i.e., OTP verified)
//     if (user.canChangePassword === false) {
//       return UnauthorizedError(res, "Unauthorized");
//     }

//     // Hash the new password
//     const hashedPassword = await hashPassword(newPassword);

//     // Update user's password in the database
//     await Student.update(
//       {
//         password: hashedPassword,
//         canChangePassword: false,
//         otp: null,
//         otpCount: 0,
//       },
//       {
//         where: { email },
//       }
//     );

//     return successOk(res, "Password updated successfully.");
//   } catch (error) {
//     catchError(res, error);
//   }
// }

// ========================= Logout ============================
export async function logoutUser(req, res) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return validationError(res, "Authorization token is required.");

    console.log("===== token ===== : ", token);

    // Verify JWT token (instead of decode)
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, jwtSecret);
    } catch (err) {
      console.log("===== err ===== : ", err);
      return validationError(res, "Invalid or expired token.");
    }

    // Convert expiry time from seconds to milliseconds
    const expiryTime = new Date(decodedToken.exp * 1000);

    // Blacklist the token
    await BlacklistToken.create({ token, expiry: expiryTime });

    successOk(res, "Logout successfully.");
  } catch (error) {
    console.log(error);
    catchError(res, error);
  }
}
