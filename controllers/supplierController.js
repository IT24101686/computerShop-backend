import User from "../models/user.js";
import bcrypt from "bcrypt";

// Add a new supplier
export function addSupplier(req, res) {
    const supplierData = req.body;

    // Force role to be supplier
    supplierData.role = "supplier";

    // Hash the password if provided
    if (supplierData.password) {
        supplierData.password = bcrypt.hashSync(supplierData.password, 10);
    }

    const supplier = new User(supplierData);

    supplier.save()
        .then((savedSupplier) => {
            // Remove password from response
            savedSupplier.password = undefined;
            return res.status(201).json({
                message: "Supplier added successfully",
                supplier: savedSupplier
            });
        })
        .catch((error) => {
            return res.status(500).json({ error: "Error adding supplier", details: error.message });
        });
}

// Get all suppliers
export function getSuppliers(req, res) {
    // Only get users with the role "supplier"
    User.find({ role: "supplier" }, { password: 0 }) // Exclude password
        .then((suppliers) => {
            return res.status(200).json(suppliers);
        })
        .catch((error) => {
            return res.status(500).json({ error: "Error retrieving suppliers", details: error.message });
        });
}

// Get a single supplier by email
export function getSupplierByEmail(req, res) {
    const email = req.params.email;

    User.findOne({ email: email, role: "supplier" }, { password: 0 })
        .then((supplier) => {
            if (!supplier) {
                return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json(supplier);
        })
        .catch((error) => {
            return res.status(500).json({ error: "Error retrieving supplier", details: error.message });
        });
}

// Update supplier details
export function updateSupplier(req, res) {
    const email = req.params.email;
    const updateData = req.body;

    // Security measure: Do not allow changing the role to something else via this endpoint
    if (updateData.role) {
        updateData.role = "supplier";
    }

    // Hash password if updating password
    if (updateData.password) {
        updateData.password = bcrypt.hashSync(updateData.password, 10);
    }

    User.updateOne({ email: email, role: "supplier" }, updateData)
        .then((result) => {
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json({ message: "Supplier updated successfully" });
        })
        .catch((error) => {
            return res.status(500).json({ error: "Error updating supplier", details: error.message });
        });
}

// Delete a supplier
export function deleteSupplier(req, res) {
    const email = req.params.email;

    User.deleteOne({ email: email, role: "supplier" })
        .then((result) => {
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json({ message: "Supplier deleted successfully" });
        })
        .catch((error) => {
            return res.status(500).json({ error: "Error deleting supplier", details: error.message });
        });
}
