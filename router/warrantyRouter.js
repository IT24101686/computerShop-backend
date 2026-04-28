import express from "express";
import { 
    createWarrantyClaim, 
    getWarrantyClaims, 
    updateClaimByAdmin, 
    updateClaimBySupplier 
} from "../controllers/warrantyController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const warrantyRouter = express.Router();

// Common: Get Claims (filtered by user role)
warrantyRouter.get("/", authorizeUser, getWarrantyClaims);

// Customer: Submit Claim
warrantyRouter.post("/", authorizeUser, createWarrantyClaim);

// Admin: Update Status / Assign Supplier
warrantyRouter.put("/admin/:id", authorizeUser, updateClaimByAdmin);

// Supplier: Update Status / Notes
warrantyRouter.put("/supplier/:id", authorizeUser, updateClaimBySupplier);

export default warrantyRouter;
