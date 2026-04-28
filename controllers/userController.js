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
        const foundUser = await User.findById(req.User.id, "-password");
        if (!foundUser) return res.status(404).json({ message: "User not found" });

        res.json({
            id: foundUser._id,
            firstName: foundUser.firstName,
            lastName: foundUser.lastName,
            email: foundUser.email,
            role: foundUser.role,
            image: foundUser.image,
            phone: foundUser.contactNumber || "",
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching user", error: err.message });
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
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === "admin") {
            return res.status(403).json({ message: "Administrator accounts cannot be deleted for security reasons." });
        }

        await User.findByIdAndDelete(req.params.id);
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
        const { firstName, lastName, phone, image } = req.body;
        const userId = req.User.id; // from middleware

        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phone !== undefined) updateData.contactNumber = phone;
        if (image !== undefined) updateData.image = image;

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
                image: user.image,
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

// ── Public: Forgot Password (Send OTP) ──
export async function forgotPassword(req, res) {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User with this email does not exist" });

        // Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Save OTP and Expiry
        user.resetToken = otp; 
        user.resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
        await user.save();

        const mailOptions = {
            from: `"TechShop Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Password Reset OTP - TechShop",
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
                    <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">TechShop</h1>
                    </div>
                    <div style="padding: 40px; text-align: center;">
                        <h2 style="color: #1e293b; margin-bottom: 10px;">Reset Your Password</h2>
                        <p style="color: #64748b; font-size: 14px; margin-bottom: 30px;">Use the 4-digit code below to reset your password. This code is valid for 10 minutes.</p>
                        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; font-size: 32px; font-weight: 800; color: #3b82f6; letter-spacing: 10px; display: inline-block;">
                            ${otp}
                        </div>
                        <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "4-digit OTP sent to your email" });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ message: "Error sending OTP", error: err.message });
    }
}

// ── Public: Verify OTP ──
export async function verifyOTP(req, res) {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ 
            email, 
            resetToken: otp,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

        res.status(200).json({ message: "OTP verified successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error verifying OTP", error: err.message });
    }
}

// ── Public: Reset Password ──
export async function resetPassword(req, res) {
    const { email, otp, newPassword } = req.body;
    try {
        const user = await User.findOne({ 
            email, 
            resetToken: otp,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

        // Update password
        user.password = bcrypt.hashSync(newPassword, 10);
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save();

        res.status(200).json({ message: "Password reset successfully! You can now login." });
    } catch (err) {
        res.status(500).json({ message: "Error resetting password", error: err.message });
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

export function isInventoryManager(req) {
    return req.User && req.User.role === "inventoryManager";
}

// ── Helper: Check if user has Admin or Product Manager access ──
export function hasAdminOrManagerAccess(req) {
    return req.User && (req.User.role === "admin" || req.User.role === "productManager");
}

export function hasInventoryAccess(req) {
    return req.User && (req.User.role === "admin" || req.User.role === "inventoryManager");
}
