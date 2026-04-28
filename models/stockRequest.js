import mongoose from "mongoose";

const stockRequestSchema = new mongoose.Schema({
    inventoryManagerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ["pending", "accepted", "fulfilled", "rejected"], default: "pending" },
    requestedDate: { type: Date, default: Date.now },
    notes: { type: String }
});

const StockRequest = mongoose.model("StockRequest", stockRequestSchema);
export default StockRequest;
