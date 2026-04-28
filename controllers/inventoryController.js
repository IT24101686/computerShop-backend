import Inventory from "../models/inventory.js";
import Product from "../models/product.js";
import User from "../models/user.js";
import StockLog from "../models/stockLog.js";
import StockRequest from "../models/stockRequest.js";
import Setting from "../models/setting.js";
import Notification from "../models/notification.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.INVENTORY_EMAIL,
        pass: process.env.INVENTORY_PASS
    }
});// 1. Supplier adds new stock (Status: Pending)
export function addSupply(req, res) {
    // Only supplier should be calling this (handled via middleware/frontend)
    const { productId, quantity, pricePerUnit, notes, warranty } = req.body;
    const supplierId = req.User.id; // From JWT token (req.User set by middleware)

    const newInventory = new Inventory({
        supplierId,
        productId,
        quantity,
        pricePerUnit,
        warranty,
        notes,
        status: "pending" // Default
    });

    newInventory.save()
        .then((inventory) => {
            return res.status(201).json({ message: "Supply request added, waiting for approval", inventory });
        })
        .catch((error) => {
            return res.status(500).json({ error: "Failed to add supply request", details: error.message });
        });
}

// 2. Inventory Manager gets all pending supplies
export async function getPendingSupplies(req, res) {
    try {
        const supplies = await Inventory.find({ status: "pending" }).populate("supplierId", "email firstName lastName companyName contactNumber");
        const productIds = supplies.map(s => s.productId);
        const products = await Product.find({ productid: { $in: productIds } });

        const detailedSupplies = supplies.map(s => {
            const product = products.find(p => p.productid === s.productId);
            return { ...s.toObject(), productDetails: product };
        });

        res.status(200).json(detailedSupplies);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending supplies", details: error.message });
    }
}

// 3. Inventory Manager gets all supplies
export async function getAllSupplies(req, res) {
    try {
        const supplies = await Inventory.find().populate("supplierId", "email firstName lastName companyName contactNumber");
        const productIds = supplies.map(s => s.productId);
        const products = await Product.find({ productid: { $in: productIds } });

        const detailedSupplies = supplies.map(s => {
            const product = products.find(p => p.productid === s.productId);
            return { ...s.toObject(), productDetails: product };
        });

        res.status(200).json(detailedSupplies);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch all supplies", details: error.message });
    }
}

// 4. Inventory Manager Approves the supply
export async function approveSupply(req, res) {
    try {
        const supplyId = req.params.id;
        const inventory = await Inventory.findById(supplyId);

        if (!inventory) {
            return res.status(404).json({ error: "Supply request not found" });
        }
        if (inventory.status !== "pending") {
            return res.status(400).json({ error: "Supply is already processed" });
        }

        // Update inventory status
        inventory.status = "approved";
        await inventory.save();

        // Update product stock
        const updatedProduct = await Product.findOneAndUpdate(
            { productid: inventory.productId },
            { $inc: { stock: inventory.quantity } },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: "Product not found to update stock" });
        }

        // Log Stock IN
        await new StockLog({
            productId: inventory.productId,
            type: "IN",
            quantity: inventory.quantity,
            source: `Supply Apprv: ${inventory._id}`
        }).save();

        // Create Notification for Stock Increase
        const admins = await User.find({ role: { $in: ["admin", "productManager"] } });
        const notifications = admins.map(admin => ({
            userId: admin._id,
            title: "📈 Stock Replenished",
            message: `${updatedProduct.name} stock increased by ${inventory.quantity} units.`,
            type: "other",
            link: "/admin/products"
        }));
        await Notification.insertMany(notifications);

        res.status(200).json({
            message: "Supply approved and stock updated successfully",
            inventory,
            productStock: updatedProduct.stock
        });

    } catch (error) {
        res.status(500).json({ error: "An error occurred", details: error.message });
    }
}

// 5. Inventory Manager Rejects the supply
export function rejectSupply(req, res) {
    const supplyId = req.params.id;

    Inventory.findById(supplyId)
        .then((inventory) => {
            if (!inventory) {
                return res.status(404).json({ error: "Supply request not found" });
            }
            if (inventory.status !== "pending") {
                return res.status(400).json({ error: "Supply is already processed" });
            }

            inventory.status = "rejected";
            return inventory.save();
        })
        .then((rejectedInventory) => {
            return res.status(200).json({ message: "Supply rejected", inventory: rejectedInventory });
        })
        .catch((error) => {
            return res.status(500).json({ error: "An error occurred", details: error.message });
        });
}

// 6. Send Alert to Suppliers and Admin (Manually triggered by Inventory Manager)
export async function alertLowStock(req, res) {
    try {
        const { productid } = req.body;
        const product = await Product.findOne({ productid });
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Get current thresholds from settings
        const settings = await Setting.findOne({ key: "lowStockThresholds" });
        const thresholds = settings ? settings.value : {
            Laptop: 5, Desktop: 10, Monitor: 8, Accessories: 20, Other: 5
        };
        const limit = thresholds[product.category] || thresholds.Other;

        // Find emails of all recipients
        const usersToAlert = await User.find({ role: { $in: ["supplier", "admin"] } });
        const emails = usersToAlert.map(u => u.email).filter(Boolean);

        if (emails.length === 0) return res.status(400).json({ message: "No recipients found" });

        const managerName = `${req.User.firstName} ${req.User.lastName}`;
        const mailOptions = {
            from: `"Inventory Manager" <${process.env.INVENTORY_EMAIL}>`,
            to: emails,
            subject: `🚨 Stock Alert: ${product.name} is Low`,
            html: `
                <div style="font-family: sans-serif; max-width: 500px; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; margin: auto;">
                    <div style="background: #f44336; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Low Stock Alert</h2>
                    </div>
                    <div style="padding: 24px; color: #333; line-height: 1.6;">
                        <p>Hello,</p>
                        <p>Our Inventory Manager, <strong>${managerName}</strong>, has flagged the following product as critically low in stock:</p>
                        <div style="background: #fff5f5; border: 1px solid #ffcdd2; border-radius: 8px; padding: 15px; margin: 15px 0;">
                            <table style="width: 100%;">
                                <tr><td><b>Product:</b></td><td>${product.name}</td></tr>
                                <tr><td><b>Category:</b></td><td>${product.category}</td></tr>
                                <tr><td><b>Current Stock:</b></td><td style="color: #f44336; font-weight: bold;">${product.stock} units</td></tr>
                                <tr><td><b>Limit Set:</b></td><td>${limit} units</td></tr>
                            </table>
                        </div>
                        <p>Please arrange for a new supply to be delivered as soon as possible.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #999; text-align: center;">Sent via Computer Shop Inventory System</p>
                    </div>
                </div>
            `
        };
        transporter.sendMail(mailOptions, (err) => {
            if (err) return res.status(500).json({ message: "Email failed" });
            res.status(200).json({ message: `Alert sent for ${product.name}!` });
        });
    } catch (error) {
        res.status(500).json({ message: "Error", error: error.message });
    }
}

// 6.5 Automatic Low Stock Check & Alert
export async function checkAndSendLowStockAlert(productId) {
    try {
        const product = await Product.findOne({ productid: productId });
        if (!product) return;

        // Get dynamic thresholds from settings
        const settings = await Setting.findOne({ key: "lowStockThresholds" });
        const limits = settings ? settings.value : {
            Laptop: 5, Desktop: 10, Monitor: 8, Accessories: 20, Other: 5
        };
        const threshold = limits[product.category] || limits.Other;

        // Condition: Stock is less than the specific category threshold
        if (Number(product.stock) < threshold) {
            // Find all Admins and Product Managers
            const managers = await User.find({ role: { $in: ["admin", "productManager"] } });
            
            for (const manager of managers) {
                // Check if we already sent a notification for this product recently (to avoid spam)
                const recent = await Notification.findOne({
                    userId: manager._id,
                    type: "low-stock",
                    title: { $regex: product.name },
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // within last 24h
                });

                if (recent) continue; // Don't spam

                // 1. Create In-App Notification
                await new Notification({
                    userId: manager._id,
                    title: `🚨 Low Stock Alert: ${product.name}`,
                    message: `Low Stock! ${product.name} has only ${product.stock} units remaining. (Threshold: ${threshold})`,
                    type: "low-stock",
                    link: "/inventory/low-stock"
                }).save();

                // 2. Send Email Alert
                if (manager.email) {
                    const mailOptions = {
                        from: `"TechShop System" <${process.env.INVENTORY_EMAIL}>`,
                        to: manager.email,
                        subject: `🚨 CRITICAL: Low Stock Alert - ${product.name}`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                <h2 style="color: #f44336;">Low Stock Alert</h2>
                                <p>Hello ${manager.firstName},</p>
                                <p>The system has detected that <strong>${product.name}</strong> is critically low on stock after a recent movement.</p>
                                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0;">
                                    <b>Current Stock:</b> <span style="color: red; font-weight: bold;">${product.stock} units remaining</span><br/>
                                    <b>Product SKU:</b> ${product.productid}<br/>
                                    <b>Category:</b> ${product.category}<br/>
                                    <b>Threshold Set:</b> ${threshold} units
                                </div>
                                <p>Please take immediate action to restock this item.</p>
                                <a href="${process.env.FRONTEND_URL}/inventory/low-stock" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Inventory Portal</a>
                            </div>
                        `
                    };
                    transporter.sendMail(mailOptions).catch(e => console.error("Auto-alert email failed", e));
                }
            }
        }
    } catch (err) {
        console.error("Auto low stock alert error", err);
    }
}

// 7. Get Stock Movement Ledger
export async function getStockLedger(req, res) {
    try {
        const logs = await StockLog.find().sort({ date: -1 });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching ledger", error: error.message });
    }
}

// 8. Create Stock Request (Manager to Supplier) + Send Email
export async function createStockRequest(req, res) {
    try {
        const { supplierId, productId, quantity, notes } = req.body;

        // Find product and supplier info for email
        const product = await Product.findOne({ productid: productId });
        const supplier = await User.findById(supplierId);

        if (!supplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }

        const newRequest = new StockRequest({
            inventoryManagerId: req.User.id,
            supplierId,
            productId,
            quantity,
            notes
        });
        await newRequest.save();

        // Send Email to Supplier
        const mailOptions = {
            from: `"Inventory Department" <${process.env.INVENTORY_EMAIL}>`,
            to: supplier.email,
            subject: `🆕 New Stock Request: ${product ? product.name : productId}`,
            text: `Hello ${supplier.firstName},\n\nA new stock request has been created by the Inventory Manager.\n\nProduct: ${product ? product.name : productId}\nQuantity: ${quantity}\nNotes: ${notes || "N/A"}\n\nPlease check your dashboard to accept or reject the request.\n\nThanks,\nInventory Management System`
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error("Stock Request email error:", err.message);
                // We still return 201 as the request is saved in DB
            }
        });

        res.status(201).json({ message: "Stock request sent to supplier successfully!", request: newRequest });
    } catch (error) {
        res.status(500).json({ message: "Error creating request", error: error.message });
    }
}

// 9. Get Stock Requests (For Manager or Supplier)
export async function getStockRequests(req, res) {
    try {
        const query = req.User.role === "supplier" ? { supplierId: req.User.id } : {};
        const requests = await StockRequest.find(query)
            .populate("inventoryManagerId", "firstName lastName email")
            .populate("supplierId", "firstName lastName companyName")
            .sort({ requestedDate: -1 });
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: "Error fetching requests", error: error.message });
    }
}

// 10. Update Stock Request Status (Accepted/Fulfilled/Rejected)
export async function updateStockRequestStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const request = await StockRequest.findByIdAndUpdate(id, { status }, { new: true });
        res.status(200).json({ message: "Status updated", request });
    } catch (error) {
        res.status(500).json({ message: "Error updating request", error: error.message });
    }
}

// ── NEW: Supplier Management of their own Supplies ──

// Supplier: Get his own supply requests
export function getMySupplies(req, res) {
    const supplierId = req.User.id;
    Inventory.find({ supplierId }).sort({ suppliedDate: -1 })
        .then((supplies) => {
            return res.status(200).json(supplies);
        })
        .catch((error) => {
            return res.status(500).json({ error: "Failed to fetch your supplies", details: error.message });
        });
}

// Supplier: Update his pending supply request
export async function updateSupply(req, res) {
    try {
        const { id } = req.params;
        const { productId, quantity, pricePerUnit, notes, warranty } = req.body;
        const supplierId = req.User.id;

        const supply = await Inventory.findById(id);
        if (!supply) return res.status(404).json({ error: "Supply request not found" });
        if (supply.supplierId.toString() !== supplierId) return res.status(403).json({ error: "Access denied" });
        if (supply.status !== "pending") return res.status(400).json({ error: "Cannot edit processed request" });

        if (productId) supply.productId = productId;
        if (quantity) supply.quantity = quantity;
        if (pricePerUnit) supply.pricePerUnit = pricePerUnit;
        if (notes) supply.notes = notes;
        if (warranty) supply.warranty = warranty;

        await supply.save();
        res.status(200).json({ message: "Supply request updated", inventory: supply });
    } catch (error) {
        res.status(500).json({ error: "Failed to update supply request", details: error.message });
    }
}

// Supplier: Delete his pending supply request
export async function deleteSupply(req, res) {
    try {
        const { id } = req.params;
        const supplierId = req.User.id;

        const supply = await Inventory.findById(id);
        if (!supply) return res.status(404).json({ error: "Supply request not found" });
        if (supply.supplierId.toString() !== supplierId) return res.status(403).json({ error: "Access denied" });
        if (supply.status !== "pending") return res.status(400).json({ error: "Cannot delete processed request" });

        await Inventory.findByIdAndDelete(id);
        res.status(200).json({ message: "Supply request deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete supply request", details: error.message });
    }
}

// 11. Get Current Stock Thresholds (Settings)
export async function getLowStockThresholds(req, res) {
    try {
        const settings = await Setting.findOne({ key: "lowStockThresholds" });
        if (!settings) {
            return res.status(200).json({
                Laptop: 5, Desktop: 10, Monitor: 8, Accessories: 20, Other: 5
            });
        }
        res.status(200).json(settings.value);
    } catch (error) {
        res.status(500).json({ message: "Error fetching thresholds", error: error.message });
    }
}

// 12. Update Stock Thresholds (Settings)
export async function updateLowStockThresholds(req, res) {
    try {
        if (!isAdmin(req) && req.User?.role !== "inventoryManager") {
            return res.status(403).json({ message: "Access denied" });
        }
        const thresholds = req.body;
        const updated = await Setting.findOneAndUpdate(
            { key: "lowStockThresholds" },
            { value: thresholds },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(200).json({ message: "Thresholds updated!", settings: updated.value });
    } catch (error) {
        res.status(500).json({ message: "Error updating thresholds", error: error.message });
    }
}

function isAdmin(req) {
    return req.User?.role === "admin";
}
