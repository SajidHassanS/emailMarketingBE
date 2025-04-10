import User from "./user/user.model.js";
import Email from "./email/email.model.js";
import Password from "./password/password.model.js";
import BlacklistToken from "./user/blackListToken.model.js";
import DuplicateEmail from "./email/duplicateEmail.model.js";
import Notification from "./notification/notification.model.js";
import Withdrawal from "./withdrawal/withdarwal.model.js";
import WithdrawalMethod from "./withdrawal/withdrawalMethod.model.js";
import SystemSetting from "./systemSetting/systemSetting.model.js";
import Bonus from "./bonus/bonus.model.js";

const models = {
  User,
  Email,
  Password,
  Notification,
  BlacklistToken,
  DuplicateEmail,
  Withdrawal,
  WithdrawalMethod,
  SystemSetting,
  Bonus,
};

export default models;
