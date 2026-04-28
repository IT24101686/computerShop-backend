import express from "express";
import {
    addSupply,
    getPendingSupplies,
    getAllSupplies,
    approveSupply,
    rejectSupply,
    alertLowStock,
    getStockLedger,
    createStockRequest,
    getStockRequests,
    updateStockRequestStatus,
    getMySupplies,
    updateSupply,
    deleteSupply,
    getLowStockThresholds,
    updateLowStockThresholds
} from "../controllers/inventoryController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const inventoryRouter = express.Router();

// Supplier adds new supply request
inventoryRouter.post("/add", authorizeUser, addSupply);

// Inventory Manager gets all pending supplies
inventoryRouter.get("/pending", authorizeUser, getPendingSupplies);

// Inventory Manager gets all supplies
inventoryRouter.get("/", authorizeUser, getAllSupplies);

// Inventory Manager approves the supply and updates product stock
inventoryRouter.put("/approve/:id", authorizeUser, approveSupply);

// Inventory Manager rejects the supply
inventoryRouter.put("/reject/:id", authorizeUser, rejectSupply);

// Inventory Manager alerts Suppliers and Admins
inventoryRouter.post("/alert-low-stock", authorizeUser, alertLowStock);

// Stock Ledger (Reports)
inventoryRouter.get("/ledger", authorizeUser, getStockLedger);

// Stock Requests (Manager to Supplier)
inventoryRouter.post("/requests", authorizeUser, createStockRequest);
inventoryRouter.get("/requests", authorizeUser, getStockRequests);
inventoryRouter.put("/requests/:id", authorizeUser, updateStockRequestStatus);

// ── NEW: Supplier's own supply management ──
inventoryRouter.get("/my-supplies", authorizeUser, getMySupplies);
inventoryRouter.put("/update/:id", authorizeUser, updateSupply);
inventoryRouter.delete("/delete/:id", authorizeUser, deleteSupply);

// Threshold Management (New)
inventoryRouter.get("/thresholds", authorizeUser, getLowStockThresholds);
inventoryRouter.put("/thresholds", authorizeUser, updateLowStockThresholds);

export default inventoryRouter;
