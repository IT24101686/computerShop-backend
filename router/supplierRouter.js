import express from "express";
import {
    addSupplier,
    getSuppliers,
    getSupplierByEmail,
    updateSupplier,
    deleteSupplier
} from "../controllers/supplierController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const supplierRouter = express.Router();

// Route to get all suppliers
supplierRouter.get("/", authorizeUser, getSuppliers);

// Route to get a specific supplier by email
supplierRouter.get("/:email", authorizeUser, getSupplierByEmail);

// Route to add a new supplier (Register via admin/inventory manager)
supplierRouter.post("/", authorizeUser, addSupplier);

// Route to update a supplier by email
supplierRouter.put("/:email", authorizeUser, updateSupplier);

// Route to delete a supplier by email
supplierRouter.delete("/:email", authorizeUser, deleteSupplier);

export default supplierRouter;
