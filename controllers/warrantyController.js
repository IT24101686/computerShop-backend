import WarrantyClaim from "../models/warrantyClaim.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import User from "../models/user.js";
import nodemailer from "nodemailer";

// Email transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Customer: Submit a claim
export async function createWarrantyClaim(req, res) {
    try {
        const { orderId, productId, issueDescription, claimType } = req.body;
        const customerId = req.User.id;

        // Verify order exists and belongs to customer
        // We use _id: orderId because that's what the frontend sends (the database _id)
        const order = await Order.findOne({ _id: orderId, userEmail: req.User.email });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Verify product in order
        const item = order.items.find(i => i.productId === productId);
        if (!item) {
            return res.status(404).json({ message: "Product not found in this order" });
        }

        // Check Warranty Period
        const product = await Product.findOne({ productid: productId });
        const warrantyStr = product?.warranty || "No Warranty";
        
        if (warrantyStr.toLowerCase() === "no warranty") {
            return res.status(400).json({ message: "This product has no warranty" });
        }

        const orderDate = new Date(order.orderedAt);
        const expiryDate = new Date(orderDate);
        
        const [numStr, unit] = warrantyStr.split(" ");
        const num = parseInt(numStr);
        if (!isNaN(num)) {
            if (unit?.toLowerCase().includes("year")) {
                expiryDate.setFullYear(expiryDate.getFullYear() + num);
            } else if (unit?.toLowerCase().includes("month")) {
                expiryDate.setMonth(expiryDate.getMonth() + num);
            }
        }

        if (new Date() > expiryDate) {
            return res.status(400).json({ 
                message: "Warranty period has expired", 
                expiredOn: expiryDate.toLocaleDateString() 
            });
        }

        const newClaim = new WarrantyClaim({
            orderId: orderId, // using the DB ID for reference
            productId,
            customerId,
            issueDescription,
            claimType
        });

        await newClaim.save();
        res.status(201).json({ message: "Warranty claim submitted successfully", claim: newClaim });
    } catch (err) {
        res.status(500).json({ message: "Error submitting claim", error: err.message });
    }
}

// Admin/Supplier: Get claims (Filter by status, role)
export async function getWarrantyClaims(req, res) {
    try {
        let query = {};
        
        // If customer, only show their claims
        if (req.User.role === "customer") {
            query.customerId = req.User.id;
        } 
        // If supplier, only show claims assigned to them
        else if (req.User.role === "supplier") {
            query.supplierId = req.User.id;
        }
        // If Admin/InvManager, show all (or filtered by status)
        if (req.query.status) {
            query.status = req.query.status;
        }

        const claims = await WarrantyClaim.find(query)
            .populate("customerId", "firstName lastName email")
            .populate("supplierId", "firstName lastName companyName")
            .sort({ submissionDate: -1 })
            .lean();

        // Attach product supplier name to filter dropdown in frontend
        for (let claim of claims) {
            const product = await Product.findOne({ productid: claim.productId });
            claim.productSupplierName = product ? product.supplier : "Unknown";
        }

        res.status(200).json(claims);
    } catch (err) {
        res.status(500).json({ message: "Error fetching claims", error: err.message });
    }
}

// Admin: Update Status and Assign Supplier
export async function updateClaimByAdmin(req, res) {
    try {
        const { id } = req.params;
        const { status, supplierId, adminNotes } = req.body;

        const claim = await WarrantyClaim.findById(id);
        if (!claim) return res.status(404).json({ message: "Claim not found" });

        if (status) claim.status = status;
        if (supplierId && supplierId !== claim.supplierId?.toString()) {
            claim.supplierId = supplierId;
            // Send email to supplier
            const supplier = await User.findById(supplierId);
            if (supplier && supplier.email) {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: supplier.email,
                    subject: `🛡️ New Warranty Claim Assigned: ${claim._id}`,
                    text: `Hello ${supplier.firstName},\n\nA new warranty claim has been assigned to you.\n\nClaim ID: ${claim._id}\nIssue: ${claim.issueDescription}\nType: ${claim.claimType}\n\nPlease log in to your dashboard to handle this claim.\n\nThank you!`
                };
                await transporter.sendMail(mailOptions);
            }
        }
        if (adminNotes) claim.adminNotes = adminNotes;
        claim.updatedAt = Date.now();

        await claim.save();
        res.status(200).json({ message: "Claim updated and supplier notified", claim });
    } catch (err) {
        res.status(500).json({ message: "Error updating claim", error: err.message });
    }
}

// Supplier: Update Status and Notes
export async function updateClaimBySupplier(req, res) {
    try {
        const { id } = req.params;
        const { status, supplierNotes } = req.body;

        const claim = await WarrantyClaim.findById(id);
        if (!claim || claim.supplierId.toString() !== req.User.id.toString()) {
            return res.status(404).json({ message: "Claim not found or not assigned to you" });
        }

        if (status) claim.status = status;
        if (supplierNotes) claim.supplierNotes = supplierNotes;
        claim.updatedAt = Date.now();

        await claim.save();
        res.status(200).json({ message: "Claim updated by supplier", claim });
    } catch (err) {
        res.status(500).json({ message: "Error updating claim", error: err.message });
    }
}
