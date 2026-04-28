import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    userEmail: {
        type: String,
        required: true
    },
    items: [
        {
            productId: { type: String, required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, min: 1 },
            image: { type: String }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    shippingAddress: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        phone: { type: String, required: true }
    },
    secondaryAddress: {
        address: { type: String, default: "" },
        city: { type: String, default: "" },
        phone: { type: String, default: "" },
        note: { type: String, default: "" }
    },
    paymentMethod: {
        type: String,
        enum: ["Cash on Delivery", "Online Payment"],
        default: "Cash on Delivery"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Refunded"],
        default: "Pending"
    },
    status: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
        default: "Pending"
    },
    trackingNumber: { type: String, default: "" },
    courierService: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    orderedAt: {
        type: Date,
        default: Date.now
    }
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
