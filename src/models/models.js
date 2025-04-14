import User from "./user/user.model.js";
import Email from "./email/email.model.js";
import Password from "./password/password.model.js";
import BlacklistToken from "./user/blackListToken.model.js";
import DuplicateEmail from "./email/duplicateEmail.model.js";
import Notification from "./notification/notification.model.js";
import Withdrawal from "./withdrawal/withdarwal.model.js";
import WithdrawalMethod from "./withdrawal/withdrawalMethod.model.js";
import SystemSetting from "./systemSetting/systemSetting.model.js";
<<<<<<< HEAD
import Bonus from "./withdrawal/bonus.model.js";
import BonusWithdrawal from "./withdrawal/bonusWithdrawal.model.js";
import Message from "./message/message.model.js";
import Admin from "./admin/admin.model.js";

const models = {
  User,
  Admin,
=======
import Bonus from "./bonus/bonus.model.js";

const models = {
  User,
>>>>>>> main
  Email,
  Password,
  Notification,
  BlacklistToken,
  DuplicateEmail,
  Withdrawal,
  WithdrawalMethod,
  SystemSetting,
  Bonus,
<<<<<<< HEAD
  BonusWithdrawal,
  Message,
=======
>>>>>>> main
};

export default models;
