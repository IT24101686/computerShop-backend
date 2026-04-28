import Order from "../models/order.js";
import Inventory from "../models/inventory.js";
import { isAdmin } from "./userController.js";

// 1. Get total revenue (income) from delivered/completed orders
export async function getIncomeSummary(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Access denied. Admins only" });
    }

    try {
        // Only count orders that have actually been paid (ignores unpaid COD)
        const orders = await Order.find({ paymentStatus: "Paid", status: { $ne: "Cancelled" } });

        const totalIncome = orders.reduce((acc, order) => acc + order.totalAmount, 0);

        res.status(200).json({
            totalIncome,
            orderCount: orders.length
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching income summary", error: error.message });
    }
}

// 2. Get total expenses (money spent on paying suppliers)
export async function getExpenseSummary(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Access denied. Admins only" });
    }

    try {
        // Find approved supplies only (as pending or rejected means we haven't paid yet)
        const supplies = await Inventory.find({ status: "approved" });

        const totalExpenses = supplies.reduce((acc, supply) => {
            return acc + (supply.quantity * supply.pricePerUnit);
        }, 0);

        res.status(200).json({
            totalExpenses,
            supplyCount: supplies.length
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching expense summary", error: error.message });
    }
}

// 3. Get overall Profit (Income - Expenses)
export async function getProfitSummary(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Access denied. Admins only" });
    }

    try {
        // Income (only paid orders)
        const orders = await Order.find({ paymentStatus: "Paid", status: { $ne: "Cancelled" } });
        const totalIncome = orders.reduce((acc, order) => acc + order.totalAmount, 0);

        // Expenses
        const supplies = await Inventory.find({ status: "approved" });
        const totalExpenses = supplies.reduce((acc, supply) => acc + (supply.quantity * supply.pricePerUnit), 0);

        // Profit
        const netProfit = totalIncome - totalExpenses;

        res.status(200).json({
            summary: {
                totalIncome,
                totalExpenses,
                netProfit
            },
            status: netProfit >= 0 ? "Profitable" : "Loss"
        });

    } catch (error) {
        res.status(500).json({ message: "Error calculating profit summary", error: error.message });
    }
}

// 4. Get a specific Invoice/Receipt for an Order (For Customers & Admins)
export async function getInvoice(req, res) {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId }).populate("userEmail", "firstName lastName email contactNumber");

        if (!order) {
            return res.status(404).json({ message: "Order not found or no invoice available" });
        }

        // Only the admin or the user who placed the order can view the invoice
        if (req.User.role !== "admin" && req.User.email !== order.userEmail) {
            return res.status(403).json({ message: "You are not authorized to view this invoice" });
        }

        // Create a structured invoice response
        const invoice = {
            shopName: "Computer Shop",
            invoiceId: `INV-${order.orderId}`,
            date: order.orderedAt,
            customerDetails: order.shippingAddress,
            items: order.items.map(item => ({
                productName: item.name,
                unitPrice: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity
            })),
            subTotal: order.totalAmount,
            tax: 0, // Optionally you can calculate tax here
            grandTotal: order.totalAmount,
            paymentMethod: order.paymentMethod,
            status: order.status
        };

        res.status(200).json(invoice);

    } catch (error) {
        res.status(500).json({ message: "Error generating invoice", error: error.message });
    }
}
