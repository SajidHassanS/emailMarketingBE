import { Op } from "sequelize";
import {
  catchError,
  frontError,
  notFound,
  successOk,
  successOkWithData,
} from "../../utils/responses.js";
import { bodyReqFields, queryReqFields } from "../../utils/requiredFields.js";
import models from "../../models/models.js";
import User from "../../models/user/user.model.js";
import Admin from "../../models/admin/admin.model.js";
const { Message } = models;

export const getAdminsForNewChat = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: ["uuid", "username"],
      order: [["username", "ASC"]],
    });

    return successOkWithData(res, "Admins fetched successfully.", admins);
  } catch (error) {
    console.error("Error fetching all users:", error);
    return catchError(res, error);
  }
};

// export const getAdminsChattedWithUser = async (req, res) => {
//   try {
//     const userUuid = req.userUid;

//     console.log("===== userUuid ===== : ", userUuid);

//     // Fetch distinct admins who have had conversations with the user
//     const admins = await Message.findAll({
//       where: {
//         [Op.or]: [
//           { senderUuid: userUuid, senderType: "user" },
//           { receiverUuid: userUuid, receiverType: "user" },
//         ],
//       },
//       include: [
//         {
//           model: Admin,
//           as: "senderByAdmin", // If the user is the sender
//           attributes: ["uuid", "username"],
//         },
//         {
//           model: Admin,
//           as: "receiverByAdmin", // If the user is the receiver
//           attributes: ["uuid", "username"],
//         },
//       ],
//       distinct: true, // Ensures that we only get distinct results
//       order: [["createdAt", "DESC"]], // Order by most recent message
//       attributes: [], // We want to select the distinct user IDs
//     });
//     console.log("===== admins ===== : ", admins);

//     // Extracting distinct admins (sender or receiver) from the result set
//     const distinctAdmins = new Map();

//     // Loop through all messages and add unique admins to the map
//     admins.forEach((message) => {
//       const sender = message.senderByAdmin;
//       const receiver = message.receiverByAdmin;

//       if (sender && !distinctAdmins.has(sender.uuid)) {
//         distinctAdmins.set(sender.uuid, sender);
//       }

//       if (receiver && !distinctAdmins.has(receiver.uuid)) {
//         distinctAdmins.set(receiver.uuid, receiver);
//       }
//     });

//     // Convert the map values (distinct users) to an array
//     const uniqueAdmins = Array.from(distinctAdmins.values());

//     console.log("===== uniqueAdmins ===== : ", uniqueAdmins);

//     // Return the list of users
//     return successOkWithData(res, "Admins fetched succesffully.", uniqueAdmins);
//   } catch (error) {
//     console.error("Error fetching admins chatted with user:", error);
//     return catchError(res, error);
//   }
// };

// Controller to get messages

export const getAdminsChattedWithUser = async (req, res) => {
  try {
    const userUuid = req.userUid;

    console.log("===== userUuid ===== : ", userUuid);

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderUuid: userUuid, senderType: "user" },
          { receiverUuid: userUuid, receiverType: "user" },
        ],
      },
      include: [
        {
          model: Admin,
          as: "senderByAdmin",
          attributes: ["uuid", "username"],
        },
        {
          model: Admin,
          as: "receiverByAdmin",
          attributes: ["uuid", "username"],
        },
      ],
      order: [["createdAt", "DESC"]],
      attributes: [],
    });

    const distinctAdmins = new Map();

    for (const message of messages) {
      const sender = message.senderByAdmin;
      const receiver = message.receiverByAdmin;

      if (
        sender &&
        sender.uuid !== userUuid &&
        !distinctAdmins.has(sender.uuid)
      ) {
        distinctAdmins.set(sender.uuid, sender);
      }

      if (
        receiver &&
        receiver.uuid !== userUuid &&
        !distinctAdmins.has(receiver.uuid)
      ) {
        distinctAdmins.set(receiver.uuid, receiver);
      }
    }

    const uniqueAdmins = Array.from(distinctAdmins.values());

    const enrichedAdmins = await Promise.all(
      uniqueAdmins.map(async (admin) => {
        const count = await Message.count({
          where: {
            senderUuid: admin.uuid,
            receiverUuid: userUuid,
            isRead: false,
          },
        });

        return {
          ...admin.toJSON(),
          unreadCount: count,
        };
      })
    );

    console.log("===== enrichedAdmins ===== : ", enrichedAdmins);

    return successOkWithData(
      res,
      "Admins fetched successfully.",
      enrichedAdmins
    );
  } catch (error) {
    console.error("Error fetching admins chatted with user:", error);
    return catchError(res, error);
  }
};

export const getAdminMessages = async (req, res) => {
  try {
    const userUuid = req.userUid; // Admin's UUID

    const reqQueryFields = queryReqFields(req, res, ["uuid"]);
    if (reqQueryFields.error) return reqQueryFields.response;

    const { uuid, page = 1, pageSize = 100, search = "" } = req.query; // Pagination params (page, pageSize) and optional search

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Fetch messages exchanged between the admin and the specified user
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderUuid: userUuid, receiverUuid: uuid },
          { senderUuid: uuid, receiverUuid: userUuid },
        ],
        content: { [Op.iLike]: `%${search}%` }, // Optional search by content (case-insensitive)
      },
      include: [
        {
          model: Admin,
          as: "senderByAdmin",
          attributes: ["uuid", "username"], // Sender user details
          required: false,
        },
        {
          model: Admin,
          as: "receiverByAdmin",
          attributes: ["uuid", "username"], // Receiver user details
          required: false,
        },
      ],
      order: [["createdAt", "ASC"]], // Order by message creation date (ascending)
      limit: pageSize, // Limit results per page
      offset: offset, // Skip previous pages
    });

    console.log("===== messages ===== : ", messages);

    // Fetch the total count of messages to calculate total pages
    const totalMessages = await Message.count({
      where: {
        [Op.or]: [
          { senderUuid: userUuid, receiverUuid: uuid },
          { senderUuid: uuid, receiverUuid: userUuid },
        ],
        content: { [Op.iLike]: `%${search}%` }, // Optional search by content (case-insensitive)
      },
    });

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalMessages / pageSize);

    // Format the messages into a desired structure
    const formattedMessages = messages.map((message) => ({
      uuid: message.uuid,
      senderUsername:
        message.senderType === "admin"
          ? message.senderByAdmin?.username || "Admin"
          : message.senderByUser?.username || "User",
      receiverUsername:
        message.receiverType === "admin"
          ? message.receiverByAdmin?.username || "Admin"
          : message.receiverByUser?.username || "User",
      content: message.content,
      isNotification: message.isNotification,
      createdAt: message.createdAt,
    }));

    // Return the list of messages using the custom response function
    return successOkWithData(res, "Successfully fetched messages with user", {
      messages: formattedMessages,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalPages: totalPages,
        totalMessages: totalMessages,
      },
    });
  } catch (error) {
    console.error("Error fetching messages with user:", error);
    catchError(res, error);
  }
};

export const getUnreadMessageCount = async (req, res) => {
  try {
    const userUuid = req.userUid;

    const reqQueryFields = queryReqFields(req, res, ["uuid"]);
    if (reqQueryFields.error) return reqQueryFields.response;

    const { uuid } = req.query;

    const count = await Message.count({
      where: {
        senderUuid: uuid,
        receiverUuid: userUuid,
        isRead: false,
      },
    });

    return successOkWithData(res, "Unread message count fetched.", { count });
  } catch (error) {
    console.error("Error fetching unread message count:", error);
    catchError(res, error);
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const userUuid = req.userUid;

    const reqQueryFields = queryReqFields(req, res, ["uuid"]);
    if (reqQueryFields.error) return reqQueryFields.response;

    const { uuid } = req.query;

    await Message.update(
      { isRead: true },
      {
        where: {
          senderUuid: uuid,
          receiverUuid: userUuid,
          isRead: false,
        },
      }
    );

    return successOk(res, "Messages marked as read.");
  } catch (error) {
    console.error("Error marking messages as read:", error);
    catchError(res, error);
  }
};
