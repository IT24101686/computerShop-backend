import Order from "../models/order.js";
import Product from "../models/product.js";
import StockLog from "../models/stockLog.js";
import { isAdmin } from "./userController.js";
import { checkAndSendLowStockAlert } from "./inventoryController.js";
import nodemailer from "nodemailer";

// Email transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Simple RAM store for OTPs
const OTP_STORE = new Map();

// POST /orders/send-otp
export async function sendPaymentOTP(req, res) {
    try {
        const email = req.User.email;
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
        
        OTP_STORE.set(email, otp);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "💳 Payment Authorization Code",
            text: `Your TechShop payment authorization OTP is: ${otp}\nDo not share this code with anyone.`
        };

        // Send actual email
        await transporter.sendMail(mailOptions);

        console.log(`------- OTP SENT TO EMAIL -------`);
        console.log(`To: ${email}`);
        console.log(`OTP: ${otp}`);
        console.log(`------------------------------`);

        res.status(200).json({ message: "OTP sent to your email" });
    } catch (error) {
        console.error("Email send error:", error);
        res.status(500).json({ message: "Failed to send OTP to email", error: error.message });
    }
}

// POST /orders  - Create a new order
export async function createOrder(req, res) {
    try {
        const { items, shippingAddress, secondaryAddress, paymentMethod, otp, promoCode } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No items in the order" });
        }

        let totalAmount = 0;
        const shippingCost = 500; // 🚚 Fixed Shipping Cost
        let finalStatus = "Pending";
        let finalPaymentStatus = "Pending";

        if (paymentMethod === "Online Payment") {
            if (!otp || OTP_STORE.get(req.User.email) !== otp) {
                return res.status(400).json({ message: "Invalid or expired OTP code!" });
            }
            // OTP is correct
            finalPaymentStatus = "Paid";
            OTP_STORE.delete(req.User.email); // clear OTP
        }

        const orderId = "ORD-" + Math.floor(Math.random() * 1000000000);

        // Verify stock + calculate total from DB price (prevent price tampering)
        for (let i = 0; i < items.length; i++) {
            const product = await Product.findOne({ productid: items[i].productId });

            if (!product) {
                return res.status(404).json({ message: `Product ${items[i].productId} not found` });
            }
            if (Number(product.stock) < Number(items[i].quantity)) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
                });
            }

            totalAmount += product.price * items[i].quantity;

            // Enrich item before saving
            items[i].name = product.name;
            items[i].price = product.price;
            items[i].image = product.image?.[0] || "";

            // Deduct stock
            product.stock -= items[i].quantity;
            await product.save();

            // Log Stock OUT
            await new StockLog({
                productId: items[i].productId,
                type: "OUT",
                quantity: items[i].quantity,
                source: `Order: ${orderId}`
            }).save();

            // Trigger Automatic Low Stock Alert if < 5
            checkAndSendLowStockAlert(items[i].productId);
        }

        // Apply dummy promo code deduction if any
        if (promoCode === "New10") {
            totalAmount = totalAmount * 0.90; // 10% discount
        }

        // Add Shipping Cost to final total
        totalAmount += shippingCost;

        const newOrder = new Order({
            orderId,
            userEmail: req.User.email,
            items,
            shippingAddress,
            secondaryAddress,
            paymentMethod,
            paymentStatus: finalPaymentStatus,
            status: finalStatus,
            totalAmount
        });

        await newOrder.save();
        res.status(201).json({ message: "Order placed successfully", order: newOrder });

    } catch (error) {
        res.status(500).json({ message: "Error placing order", error: error.message });
    }
}

// GET /orders/my-orders  - Get logged-in user's orders
export async function getMyOrders(req, res) {
    try {
        const orders = await Order.find({ userEmail: req.User.email }).sort({ orderedAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders", error: error.message });
    }
}

// GET /orders  - Admin: Get all orders
export async function getAllOrders(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ message: "Access denied. Admins only" });
        }
        const orders = await Order.find().sort({ orderedAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders", error: error.message });
    }
}

// PUT /orders/:orderId/status  - Admin: Update order status
export async function updateOrderStatus(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ message: "Access denied. Admins only" });
        }
        const { orderId } = req.params;
        const { status, paymentStatus, trackingNumber, courierService, adminNotes } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Auto-generate tracking number if status is 'Shipped' and not provided
        if (status === "Shipped" && !trackingNumber && !order.trackingNumber) {
            const randomID = Math.random().toString(36).substring(2, 9).toUpperCase();
            order.trackingNumber = `TRK-${randomID}`;
        }
        
        // Prevent shipping if payment not done (except COD)
        if ((status === "Shipped" || status === "Delivered") && order.paymentMethod !== "Cash on Delivery") {
            const ps = paymentStatus || order.paymentStatus;
            if (ps !== "Paid") {
                return res.status(400).json({
                    message: "Cannot ship/deliver. Mark payment as Paid first."
                });
            }
        }

        // If cancelled → restore stock
        if (status === "Cancelled" && order.status !== "Cancelled") {
            for (const item of order.items) {
                await Product.findOneAndUpdate(
                    { productid: item.productId },
                    { $inc: { stock: item.quantity } }
                );

                // Log Stock IN (returned from cancellation)
                await new StockLog({
                    productId: item.productId,
                    type: "IN",
                    quantity: item.quantity,
                    source: `Cancelled: ${orderId}`
                }).save();
            }
        }

        if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
        if (courierService !== undefined) order.courierService = courierService;
        if (adminNotes !== undefined) order.adminNotes = adminNotes;

        const previousStatus = order.status;
        if (status) order.status = status;
        if (paymentStatus) order.paymentStatus = paymentStatus;
        await order.save();

        if (status && status !== previousStatus) {
            let subject = "";
            let text = "";
            if (status === "Shipped") {
                subject = `📦 Your Order ${order.orderId} has been Shipped!`;
                text = `Hello ${order.shippingAddress.firstName},\n\nYour order ${order.orderId} has been shipped!\nCourier: ${order.courierService || 'Not specified'}\nTracking Number: ${order.trackingNumber || 'Not specified'}\n\nThank you for shopping with us!`;
            } else if (status === "Delivered") {
                subject = `✅ Your Order ${order.orderId} is Delivered!`;
                text = `Hello ${order.shippingAddress.firstName},\n\nYour order ${order.orderId} has been marked as delivered. We hope you enjoy your purchase!\n\nThank you for shopping with us!`;
            } else if (status === "Cancelled") {
                subject = `❌ Order Cancelled: ${order.orderId}`;
                text = `Hello ${order.shippingAddress.firstName},\n\nUnfortunately, your order ${order.orderId} has been cancelled. If you have any questions, please contact our support.\n\nSorry for the inconvenience.`;
            }

            if (subject) {
                try {
                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: order.userEmail,
                        subject: subject,
                        text: text
                    });
                    console.log(`------- EMAIL SENT TO: ${order.userEmail} -------`);
                } catch (emailError) {
                    console.error("Order status email error:", emailError);
                }
            }
        }

        res.status(200).json({ message: "Order updated", order });
    } catch (error) {
        res.status(500).json({ message: "Error updating order", error: error.message });
    }
}

// PUT /orders/:orderId/cancel  - Customer: Cancel their own pending order
export async function cancelMyOrder(req, res) {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId, userEmail: req.User.email });

        if (!order) {
            return res.status(404).json({ message: "Order not found or you do not have permission." });
        }

        if (order.status !== "Pending") {
            return res.status(400).json({ message: `Cannot cancel an order that is already ${order.status}.` });
        }

        // Restore Stock
        for (const item of order.items) {
            await Product.findOneAndUpdate(
                { productid: item.productId },
                { $inc: { stock: item.quantity } }
            );

            // Log Stock IN
            await new StockLog({
                productId: item.productId,
                type: "IN",
                quantity: item.quantity,
                source: `Customer Cancelled: ${orderId}`
            }).save();
        }

        order.status = "Cancelled";
        await order.save();

        // Send Email
        try {
            await transporter.sendMail({
                from: `"TechShop Support" <${process.env.EMAIL_USER}>`,
                to: order.userEmail,
                subject: `❌ Order Cancelled: ${order.orderId}`,
                text: `Hello ${order.shippingAddress.firstName},\n\nYou have successfully cancelled your order ${order.orderId}.\nThe stock has been replenished, and any pending payment holds will be released.\n\nThank you.`
            });
        } catch (emailErr) {
            console.error("Cancellation email error:", emailErr);
        }

        res.status(200).json({ message: "Order cancelled and stock replenished.", order });
    } catch (error) {
        res.status(500).json({ message: "Error cancelling order", error: error.message });
    }
}

// Admin: Get Sales Analytics (Last 7 Days Revenue)
export async function getSalesStats(req, res) {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const stats = await Order.aggregate([
            {
                $match: {
                    orderedAt: { $gte: sevenDaysAgo },
                    status: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderedAt" } },
                    totalRevenue: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ message: "Error fetching sales stats", error: error.message });
    }
}
