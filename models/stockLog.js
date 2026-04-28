import mongoose from "mongoose";

const stockLogSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    quantity: { type: Number, required: true },
    source: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const StockLog = mongoose.model("StockLog", stockLogSchema);
export default StockLog;
