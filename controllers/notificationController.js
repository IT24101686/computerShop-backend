import Notification from "../models/notification.js";
import User from "../models/user.js";

// Helper to create notification for all admins and inventory managers
export async function createAdminNotification({ title, message, type, link }) {
    try {
        const admins = await User.find({ role: { $in: ["admin", "productManager"] } });
        console.log(`Found ${admins.length} admins/product-managers to notify.`);
        
        const notifications = admins.map(admin => ({
            userId: admin._id,
            title,
            message,
            type,
            link
        }));
        
        if (notifications.length > 0) {
            const result = await Notification.insertMany(notifications);
            console.log(`Successfully created ${result.length} notifications.`);
        } else {
            console.warn("No admins/managers found to receive notifications.");
        }
    } catch (error) {
        console.error("Failed to create notifications:", error);
    }
}

export async function getNotifications(req, res) {
    try {
        const notifications = await Notification.find({ userId: req.User.id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notifications", error: error.message });
    }
}

export async function markAsRead(req, res) {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Error updating notification", error: error.message });
    }
}

export async function markAllAsRead(req, res) {
    try {
        await Notification.updateMany({ userId: req.User.id, isRead: false }, { isRead: true });
        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Error updating notifications", error: error.message });
    }
}

export async function deleteNotification(req, res) {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.User.id });
        res.status(200).json({ message: "Notification deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting notification", error: error.message });
    }
}
