import User from "../models/user.js";
import Inventory from "../models/inventory.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import Category from "../models/category.js";
import Review from "../models/review.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";
dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});


export function createUser(req, res) {
    const { email, firstName, lastName, password, phone } = req.body;

    // Validation (Exactly 10 digits)
    if (!phone || !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ message: "A valid 10-digit phone number is required." });
    }

    const hashpassword = bcrypt.hashSync(password, 10);
    const user = new User({
        email,
        firstName,
        lastName,
        password: hashpassword,
        role: "customer",
        contactNumber: phone,
    });
    user.save()
        .then(() => res.json({ message: "User created successfully" }))
        .catch(err => res.status(400).json({ message: "Error creating user", error: err.message }));
}


// ── Public: Register as Supplier or Inventory Manager (Pending Approval) ──
export async function registerStaffUser(req, res) {
    try {
        const { firstName, lastName, email, password, role, companyName, contactNumber } = req.body;

        if (!["supplier", "inventoryManager"].includes(role)) {
            return res.status(400).json({ message: "Invalid role. Only 'supplier' or 'inventoryManager' allowed." });
        }
        if (!firstName || !lastName || !email || !password || !contactNumber) {
            return res.status(400).json({ message: "All fields including contact number are required." });
        }
        if (!/^\d{10}$/.test(contactNumber)) {
            return res.status(400).json({ message: "Contact number must be exactly 10 digits." });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Email already registered." });
        }

        const hashed = bcrypt.hashSync(password, 10);
        const user = new User({
            firstName,
            lastName,
            email,
            password: hashed,
            role,
            companyName: companyName || "",
            contactNumber: contactNumber || "",
            isApproved: false, // 🔒 Staff must be approved by Admin
        });

        await user.save();
        res.status(201).json({ message: "Account created successfully! Please wait for Admin approval to log in." });

    } catch (err) {
        console.error("Staff Registration Error:", err);
        res.status(500).json({ message: "Registration failed.", error: err.message });
    }
}

// ── Public: Login ──
export function loginUser(req, res) {
    User.findOne({ email: req.body.email }).then((foundUser) => {
        if (foundUser == null) {
            return res.status(404).json({ message: "User with given email not found" });
        }
        const isPasswordValid = bcrypt.compareSync(req.body.password, foundUser.password);
        if (isPasswordValid) {
            if (foundUser.isApproved === false) {
                return res.status(403).json({ message: "Your account is still pending Admin approval." });
            }
            if (foundUser.isBlocked) {
                return res.status(403).json({ message: "Your account has been blocked by Admin." });
            }

            const firstName = foundUser.firstName;
            const token = jwt.sign(
                {
                    id: foundUser._id,
                    email: foundUser.email,
                    firstName: firstName,
                    lastName: foundUser.lastName,
                    role: foundUser.role,
                    image: foundUser.image,
                    isEmailVerified: foundUser.isEmailVerified,
                },
                process.env.SECRET_KEY,
                { expiresIn: "3h" }
            );
            console.log(`Login Successful: ${foundUser.email} (Role: ${foundUser.role})`);
            
            // ── Generate Unique Session ID (SID) ──
            const sid = Math.random().toString(36).substring(2, 15);
            
            // ── Send Token in SID-Specific Cookie ──
            res.cookie(`token_${sid}`, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 3 * 60 * 60 * 1000, // 3 hours
            });

            res.json({
                message: "Login successful",
                sid: sid, // Send SID to frontend to store in sessionStorage
                role: foundUser.role,
                user: {
                    id: foundUser._id,
                    firstName: firstName,
                    lastName: foundUser.lastName,
                    email: foundUser.email,
                    role: foundUser.role,
                    image: foundUser.image,
                    phone: foundUser.contactNumber || "",
                }
            });
        } else {
            res.status(401).json({ message: "Invalid password" });
        }
    });
}

// ── Public: Logout ──
export function logoutUser(req, res) {
    const { sid, role } = req.body;
    if (sid) {
        res.clearCookie(`token_${sid}`);
    } else if (role) {
        res.clearCookie(`token_${role}`);
    } else {
        // Clear all known cookies starting with token_
        const cookies = req.cookies;
        for (const cookieName in cookies) {
            if (cookieName.startsWith("token_") || cookieName === "token") {
                res.clearCookie(cookieName);
            }
        }
    }
    res.json({ message: "Logged out successfully" });
}

// ── Private: Get Me (Check Session) ──
export async function getMe(req, res) {
    try {
        const user = await User.findById(req.User.id, "-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Error fetching user info", error: err.message });
    }
}

// ── Admin: Get all users ──
export async function getAllUsers(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });
    try {
        const users = await User.find({}, "-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching users", error: err.message });
    }
}

// ── Admin/Manager: Get Pending Staff ──
export async function getPendingStaff(req, res) {
    if (!isAdmin(req) && req.User?.role !== "inventoryManager") return res.status(403).json({ message: "Access denied" });
    try {
        const query = { isApproved: false };
        // If inventory manager, only show suppliers
        if (req.User.role === "inventoryManager") {
            query.role = "supplier";
        } else {
            query.role = { $in: ["supplier", "inventoryManager"] };
        }

        const users = await User.find(query, "-password");
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching pending staff", error: err.message });
    }
}

// ── Admin/Manager: Approve Staff ──
export async function approveStaffUser(req, res) {
    if (!isAdmin(req) && req.User?.role !== "inventoryManager") return res.status(403).json({ message: "Access denied" });
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Inventory Manager can only approve suppliers
        if (req.User.role === "inventoryManager" && user.role !== "supplier") {
            return res.status(403).json({ message: "You can only approve suppliers" });
        }

        user.isApproved = true;
        await user.save();

        res.json({ message: "Staff account approved successfully", user });
    } catch (err) {
        res.status(500).json({ message: "Error approving staff", error: err.message });
    }
}

// ── Admin: Delete user ──
export async function deleteUser(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting user", error: err.message });
    }
}

// ── Admin: Create staff account (supplier / inventoryManager) ──
export async function createStaffUser(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });
    try {
        const { firstName, lastName, email, password, role, companyName, contactNumber } = req.body;

        if (!["supplier", "inventoryManager"].includes(role)) {
            return res.status(400).json({ message: "Role must be 'supplier' or 'inventoryManager'" });
        }
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "Email already registered" });

        const hashed = bcrypt.hashSync(password, 10);
        const user = new User({
            firstName,
            lastName,
            email,
            password: hashed,
            role,
            companyName: companyName || "",
            contactNumber: contactNumber || "",
            isApproved: true, // Auto-approved since Admin is creating it
        });
        await user.save();
        res.status(201).json({
            message: "Staff account created successfully",
            user: { firstName, lastName, email, role }
        });
    } catch (err) {
        console.error("Staff creation error:", err);
        res.status(500).json({
            message: err.message || "Error creating staff account",
            error: err.name
        });
    }
}

// ── Admin: Change user role ──
export async function changeUserRole(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });
    try {
        const { role } = req.body;
        if (!["admin", "customer", "supplier", "inventoryManager"].includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 🔒 Restrictions: Only 'supplier' and 'inventoryManager' roles can be modified.
        // Admins and Customers roles are protected.
        if (user.role === "admin" || user.role === "customer") {
            return res.status(403).json({
                message: `Forbidden: Cannot modify role for ${user.role} users.`
            });
        }

        user.role = role;
        await user.save();

        res.json({ message: "Role updated successfully", user: { email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ message: "Error updating role", error: err.message });
    }
}

// ── Admin: Block/Unblock user ──
export async function toggleBlockUser(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Cannot block yourself
        if (user._id.toString() === req.User.id) {
            return res.status(400).json({ message: "You cannot block yourself!" });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
            isBlocked: user.isBlocked
        });
    } catch (err) {
        res.status(500).json({ message: "Error toggling block status", error: err.message });
    }
}

// ── Private: Update Profile (logged in only) ──
export async function updateUserProfile(req, res) {
    try {
        const { firstName, lastName, phone } = req.body;
        const userId = req.User.id; // from middleware

        const updateData = {};
        if (firstName) {
            updateData.firstName = firstName;
        }
        if (lastName) updateData.lastName = lastName;
        if (phone !== undefined) updateData.contactNumber = phone;

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                phone: user.contactNumber || "",
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Profile update failed", error: err.message });
    }
}

// ── User: Shipping Addresses Management ──
export async function getAddresses(req, res) {
    try {
        const user = await User.findById(req.User.id, "addresses");
        res.json(user.addresses || []);
    } catch (err) {
        res.status(500).json({ message: "Error fetching addresses", error: err.message });
    }
}

export async function saveAddress(req, res) {
    try {
        const { label, firstName, lastName, address, city, phone, isDefault } = req.body;
        const user = await User.findById(req.User.id);
        
        if (isDefault) {
            user.addresses.forEach(a => a.isDefault = false);
        }

        user.addresses.push({ label, firstName, lastName, address, city, phone, isDefault });
        await user.save();
        res.json({ message: "Address saved successfully", addresses: user.addresses });
    } catch (err) {
        res.status(500).json({ message: "Error saving address", error: err.message });
    }
}

export async function deleteAddress(req, res) {
    try {
        const { addressId } = req.params;
        const user = await User.findById(req.User.id);
        user.addresses = user.addresses.filter(a => a._id.toString() !== addressId);
        await user.save();
        res.json({ message: "Address removed successfully", addresses: user.addresses });
    } catch (err) {
        res.status(500).json({ message: "Error deleting address", error: err.message });
    }
}

// Admin: Get Supplier Stats (Performance & Summary)
export async function getSupplierStats(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ message: "Access denied. Admins only" });
        }

        const suppliers = await User.find({ role: "supplier" });
        const allSupplies = await Inventory.find();

        const stats = suppliers.map(s => {
            const supplierSupplies = allSupplies.filter(sup => sup.supplierId.toString() === s._id.toString());
            const approvedSupplies = supplierSupplies.filter(sup => sup.status === "approved");

            return {
                id: s._id,
                name: `${s.firstName} ${s.lastName}`,
                company: s.companyName,
                email: s.email,
                contact: s.contactNumber,
                isApproved: s.isApproved,
                totalSupplies: supplierSupplies.length,
                approvedCount: approvedSupplies.length,
                totalValue: approvedSupplies.reduce((sum, sup) => sum + (sup.quantity * sup.pricePerUnit), 0),
                lastSupplied: approvedSupplies.length > 0 ? approvedSupplies.sort((a, b) => b.suppliedDate - a.suppliedDate)[0].suppliedDate : null
            };
        });

        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ message: "Error fetching supplier stats", error: error.message });
    }
}

// ── Public: Forgot Password ──
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required." });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "No account found with this email." });

        // Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        user.resetToken = resetToken;
        user.resetTokenExpiry = resetTokenExpiry;
        await user.save();

        // Send real email with reset link
        const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

        const mailOptions = {
            from: `"Computer Shop Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔐 Password Reset Request",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>You requested to reset your password. Click the button below to set a new password. This link will expire in 1 hour.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    </div>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                    <hr />
                    <p style="font-size: 12px; color: #777;">&copy; 2026 Computer Shop Management System</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error("Forgot Password Email Error:", err.message);
                return res.status(500).json({ message: "Failed to send reset email. Please try again later." });
            }
            res.json({ message: "Password reset link sent to your email! Please check your inbox." });
        });

    } catch (err) {
        res.status(500).json({ message: "Failed to process reset request.", error: err.message });
    }
}

// ── Public: Reset Password ──
export async function resetPassword(req, res) {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: new Date() }, // Token must not be expired
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
        }

        // Update password and clear token
        user.password = bcrypt.hashSync(password, 10);
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save();

        res.json({ message: "Password reset successfully! Please log in with your new password." });

    } catch (err) {
        res.status(500).json({ message: "Password reset failed.", error: err.message });
    }
}

// Admin: Get Dashboard Overview (Total counts & Pending items)
export async function getDashboardOverview(req, res) {
    try {
        if (!hasAdminOrManagerAccess(req)) return res.status(403).json({ message: "Access denied" });

        const [userCount, productCount, categoryCount, reviewCount, orders] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Category.countDocuments(),
            Review.countDocuments(),
            Order.find()
        ]);

        const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'Cancelled' ? o.totalAmount : 0), 0);
        const pendingOrders = orders.filter(o => o.status === 'Pending').length;
        const lowStockCount = await Product.countDocuments({ stock: { $lte: 5 } });

        // Order distribution for Pie Chart
        const statusDistribution = orders.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1;
            return acc;
        }, {});

        // Product distributions for analytics
        const [categoryDistribution, ratingDistribution, lowStockByCategory] = await Promise.all([
            Product.aggregate([
                { $match: { isDeleted: false } },
                { $group: { _id: "$category", count: { $sum: 1 } } }
            ]),
            Review.aggregate([
                { $group: { _id: "$rating", count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Product.aggregate([
                { $match: { isDeleted: false, stock: { $lte: 5 } } },
                { $group: { _id: "$category", count: { $sum: 1 } } }
            ])
        ]);

        res.status(200).json({
            stats: {
                totalUsers: userCount,
                totalProducts: productCount,
                totalOrders: orders.length,
                totalRevenue,
                pendingOrders,
                lowStockCount,
                totalCategories: categoryCount,
                totalReviews: reviewCount
            },
            statusDistribution,
            categoryDistribution,
            ratingDistribution,
            lowStockByCategory,
            recentOrders: orders.slice(-5).reverse()
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching dashboard stats", error: error.message });
    }
}

// ── Admin: Get Specific User Insights (Orders, Spending, etc.) ──
export async function getUserInsights(req, res) {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

        const userId = req.params.id;
        const user = await User.findById(userId, "-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        // Get orders linked to this user's email
        const orders = await Order.find({ userEmail: user.email }).sort({ orderedAt: -1 });

        // Calculate stats
        const totalSpent = orders.reduce((sum, order) => sum + (order.status !== 'Cancelled' ? order.totalAmount : 0), 0);
        const orderCount = orders.length;
        const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;

        // Flatten some items to see what they buy frequently (optional but good for insights)
        const recentProducts = orders.slice(0, 5).flatMap(o => o.items);

        res.status(200).json({
            user,
            insights: {
                totalSpent,
                orderCount,
                cancelledOrders,
                recentOrders: orders.slice(0, 10), // Limit to last 10
                recentProducts
            }
        });
    } catch (error) {
        console.error("User Insights Error:", error);
        res.status(500).json({ message: "Error fetching user insights", error: error.message });
    }
}

// ── Helper: Check if user is Admin ──
export function isAdmin(req) {
    return req.User && req.User.role === "admin";
}

// ── Helper: Check if user is Product Manager ──
export function isProductManager(req) {
    return req.User && req.User.role === "productManager";
}

// ── Helper: Check if user has Admin or Product Manager access ──
export function hasAdminOrManagerAccess(req) {
    return req.User && (req.User.role === "admin" || req.User.role === "productManager");
}
