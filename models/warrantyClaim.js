import mongoose from "mongoose";

const warrantyClaimSchema = new mongoose.Schema({
    orderId: { type: String, required: true }, 
    productId: { type: String, required: true }, 
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
    issueDescription: { type: String, required: true },
    claimType: { type: String, enum: ["Repair", "Replacement"], required: true },
    status: { 
        type: String, 
        enum: ["Pending", "Approved", "Sent to Supplier", "Repairing", "Replaced", "Completed", "Rejected"], 
        default: "Pending" 
    },
    adminNotes: { type: String },
    supplierNotes: { type: String },
    submissionDate: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const WarrantyClaim = mongoose.model("WarrantyClaim", warrantyClaimSchema);
export default WarrantyClaim;
