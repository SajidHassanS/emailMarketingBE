import { DataTypes } from "sequelize";
import sequelize from "../../config/dbConfig.js";
import User from "../user/user.model.js";

const Bonus = sequelize.define(
    "Bonus",
    {
        uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userUuid: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'Users', key: 'uuid' },
            onDelete: 'CASCADE',
        },
        type: {
            type: DataTypes.ENUM('signup', 'referral'),
            allowNull: false,
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        unlockedAfterFirstWithdrawal: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        refereeUuid: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: User,
                key: 'uuid',
            },
        }
    },
    {
        schema: "public",
        timestamps: true,
        underscored: true,
    }
);

export default Bonus;

// ========================= Relations ============================

// Define associations
User.hasMany(Bonus, {
    foreignKey: 'userUuid',
    as: 'bonuses',
    onDelete: 'CASCADE',
});

Bonus.belongsTo(User, {
    foreignKey: 'userUuid',
    as: 'user',
});

// relationship with the referee (the user who used the referral code)
Bonus.belongsTo(User, {
    foreignKey: 'refereeUuid',
    as: 'referee',
});


// ==============================================================================================================================

import { DataTypes } from "sequelize";
import sequelize from "../../config/dbConfig.js";
import Bonus from "../withdrawal/bonus.model.js";
import User from "../user/user.model.js";
import WithdrawalMethod from "./withdrawalMethod.model.js";

const BonusWithdrawal = sequelize.define(
    "BonusWithdrawal",
    {
        uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        bonusUuid: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "Bonuses",
                key: "uuid",
            },
            onDelete: "CASCADE",
        },
        userUuid: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "Users",
                key: "uuid",
            },
            onDelete: "CASCADE",
        },
        withdrawalMethodUuid: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "WithdrawalMethod", key: "uuid" },
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending',
        },
    },
    {
        schema: "public",
        timestamps: true,
        underscored: true,
    }
);

export default BonusWithdrawal;

// ===================== Associations ======================

Bonus.hasMany(BonusWithdrawal, {
    foreignKey: "bonusUuid",
    as: "withdrawals",
    onDelete: "CASCADE",
});

BonusWithdrawal.belongsTo(Bonus, {
    foreignKey: "bonusUuid",
    as: "bonus",
});

User.hasMany(BonusWithdrawal, {
    foreignKey: "userUuid",
    as: "bonusWithdrawals",
});

BonusWithdrawal.belongsTo(User, {
    foreignKey: "userUuid",
    as: "user",
});

WithdrawalMethod.hasMany(BonusWithdrawal, {
    foreignKey: "withdrawalMethodUuid",
    as: "bonusWithdrawals",
});
BonusWithdrawal.belongsTo(WithdrawalMethod, {
    foreignKey: "withdrawalMethodUuid",
    as: "withdrawalMethod",
});


// =========================================================================================================================================

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
        const availableBonuses = bonuses.filter((bonus) => {
            // Skip the bonus if we have already processed it
            if (processedBonusUuids.has(bonus.uuid)) {
                return false;
            }

            // If the bonus has no withdrawals, it's available
            if (!bonus.withdrawals || bonus.withdrawals.length === 0) return true;

            // Track if this bonus has been approved (if so, this bonus should not be included)
            const hasApprovedWithdrawal = bonus.withdrawals.some(
                (withdrawal) => withdrawal.status === "approved"
            );

            if (hasApprovedWithdrawal) {
                // If there's an approved withdrawal, exclude this bonus completely
                processedBonusUuids.add(bonus.uuid); // Mark as processed
                return false;
            }

            // Track if this bonus has any rejected withdrawals
            const hasRejectedWithdrawal = bonus.withdrawals.some(
                (withdrawal) => withdrawal.status === "rejected"
            );

            // If we found a rejected withdrawal and it hasn't been processed yet, include this bonus
            if (hasRejectedWithdrawal) {
                processedBonusUuids.add(bonus.uuid); // Mark as processed
                return true;
            }

            return false;
        });

        // Find the available bonuses by type
        const signupBonus = availableBonuses.find((b) => b.type === "signup");
        const referralBonus = availableBonuses.find((b) => b.type === "referral");

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

    if (!["signup", "referral"].includes(bonusType)) {
        return frontError(
            res,
            "Invalid bonus type. It must be 'signup' or 'referral'."
        );
    }

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

    // // Validate bonusType
    // if (!["signup", "referral"].includes(bonusType)) {
    //   return frontError(
    //     res,
    //     "Invalid bonus type. It must be 'signup' or 'referral'."
    //   );
    // }

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
