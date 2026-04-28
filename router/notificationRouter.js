import express from "express";
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from "../controllers/notificationController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const router = express.Router();

router.get("/", authorizeUser, getNotifications);
router.put("/:id/read", authorizeUser, markAsRead);
router.put("/read-all", authorizeUser, markAllAsRead);
router.delete("/:id", authorizeUser, deleteNotification);

export default router;
