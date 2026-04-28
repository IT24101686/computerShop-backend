import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    productId: {
        type: String, // Referencing the productid from the Product schema
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1 // Cannot supply 0 or negative quantities
    },
    pricePerUnit: {
        type: Number, // The cost price at which the supplier gave it
        required: true
    },
    warranty: {
        type: String, // E.g., "1 Year", "6 Months", "No Warranty"
        default: "No Warranty"
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending" // Inventory Manager configures this
    },
    suppliedDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String // Any extra details provided by supplier
    }
});

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
