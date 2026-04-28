import Review from "../models/review.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
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

// Add a new review
export async function addReview(req, res) {
    try {
        const { productId, rating, comment } = req.body;

        // Ensure user is logged in
        if (!req.User || !req.User.email) {
            return res.status(401).json({ message: "Please login to add a review" });
        }

        // Check if user has purchased this product and it is delivered
        const deliveredOrder = await Order.findOne({
            userEmail: req.User.email,
            status: "Delivered",
            "items.productId": productId
        });

        if (!deliveredOrder) {
            return res.status(403).json({
                message: "You can only review products that you have purchased and that have been delivered to you."
            });
        }

        // Check if product exists
        const product = await Product.findOne({ productid: productId });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if the user already reviewed this product
        const existingReview = await Review.findOne({
            productId: productId,
            userEmail: req.User.email
        });

        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this product" });
        }

        // Create new review
        const newReview = new Review({
            productId,
            userEmail: req.User.email,
            userName: req.User.firstName + " " + (req.User.lastName || ""),
            rating,
            comment
        });

        await newReview.save();

        // Notify Admins and Product Managers
        try {
            const adminUsers = await User.find({ role: { $in: ["admin", "productManager"] } });
            const notifications = adminUsers.map(admin => ({
                userId: admin._id,
                title: "⭐ New Product Review",
                message: `${req.User.firstName} has reviewed ${product.name}.`,
                type: "other",
                link: "/admin/reviews"
            }));
            await Notification.insertMany(notifications);
        } catch (notifError) {
            console.error("Failed to create review notifications:", notifError);
        }

        res.status(201).json({ message: "Review added successfully", review: newReview });

    } catch (error) {
        res.status(500).json({ message: "Error adding review", error: error.message });
    }
}

// Get all reviews (Admin only)
export async function getAllReviews(req, res) {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 });

        // Enrich with product names
        const enrichedReviews = await Promise.all(reviews.map(async (review) => {
            const product = await Product.findOne({ productid: review.productId });
            return {
                ...review.toObject(),
                productName: product ? product.name : "Unknown Product"
            };
        }));

        res.status(200).json(enrichedReviews);
    } catch (error) {
        res.status(500).json({ message: "Error fetching all reviews", error: error.message });
    }
}

// Get all reviews for a specific product
export async function getProductReviews(req, res) {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

        // Calculate average rating
        let averageRating = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
            averageRating = (sum / reviews.length).toFixed(1);
        }

        res.status(200).json({
            totalReviews: reviews.length,
            averageRating: Number(averageRating),
            reviews
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching reviews", error: error.message });
    }
}

// Delete a review (Admin or Author only)
export async function deleteReview(req, res) {
    try {
        const reviewId = req.params.id;
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Check authorization (Admin or the user who wrote the review)
        if (req.User.role === "admin" || req.User.email === review.userEmail) {
            await Review.findByIdAndDelete(reviewId);
            return res.status(200).json({ message: "Review deleted successfully" });
        } else {
            return res.status(403).json({ message: "You cannot delete this review" });
        }

    } catch (error) {
        res.status(500).json({ message: "Error deleting review", error: error.message });
    }
}

// Update a review (Author only)
export async function updateReview(req, res) {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;
        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Only author can edit (Admins can only delete)
        if (req.User.email !== review.userEmail) {
            return res.status(403).json({ message: "You can only edit your own reviews" });
        }

        review.rating = rating;
        review.comment = comment;
        await review.save();

        res.status(200).json({ message: "Review updated successfully", review });
    } catch (error) {
        res.status(500).json({ message: "Error updating review", error: error.message });
    }
}

// Reply to a review (Admin/Manager only)
export async function replyToReview(req, res) {
    try {
        const { id } = req.params;
        const { reply } = req.body;

        if (!hasAdminOrManagerAccess(req)) {
            return res.status(403).json({ message: "Access denied. Admins/Managers only." });
        }

        const review = await Review.findById(id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        review.reply = reply;
        review.repliedAt = new Date();
        await review.save();

        // Send Email Notification to Customer
        try {
            const product = await Product.findOne({ productid: review.productId });
            const productName = product ? product.name : "your purchased product";

            const mailOptions = {
                from: `"TechShop Support" <${process.env.EMAIL_USER}>`,
                to: review.userEmail,
                subject: "TechShop Store Response to Your Review",
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #f8fafc;">
                        <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">TechShop</h1>
                            <p style="color: #94a3b8; margin: 5px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Official Response Notification</p>
                        </div>
                        <div style="padding: 40px; background-color: #ffffff;">
                            <p style="font-size: 16px; color: #1e293b; line-height: 1.6;">Hello <strong>${review.userName}</strong>,</p>
                            <p style="font-size: 14px; color: #64748b; line-height: 1.6;">Our team has officially responded to your review for <strong>${productName}</strong>.</p>
                            
                            <div style="margin: 30px 0; padding: 25px; background-color: #f1f5f9; border-left: 4px solid #3b82f6; border-radius: 8px;">
                                <p style="margin: 0 0 10px; font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em;">Your Review:</p>
                                <p style="margin: 0 0 20px; font-size: 14px; color: #475569; font-style: italic;">"${review.comment}"</p>
                                
                                <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;" />
                                
                                <p style="margin: 0 0 10px; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Our Response:</p>
                                <p style="margin: 0; font-size: 15px; color: #0f172a; line-height: 1.6; font-weight: 500;">${reply}</p>
                            </div>

                            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 30px;">Thank you for your feedback! It helps us improve our service and products for the entire community.</p>
                            
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/products/${review.productId}" 
                                   style="display: inline-block; padding: 14px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.025em; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">
                                    View Full Discussion
                                </a>
                            </div>
                        </div>
                        <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 11px; color: #94a3b8;">&copy; 2026 TechShop Management System. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`Reply email sent to ${review.userEmail}`);
        } catch (emailError) {
            console.error("Failed to send reply email:", emailError);
            // We don't return error to user here because the reply was saved successfully
        }

        res.status(200).json({ message: "Reply added and email sent successfully", review });
    } catch (error) {
        res.status(500).json({ message: "Error adding reply", error: error.message });
    }
}

// Helper: Check if user has Admin or Product Manager access
function hasAdminOrManagerAccess(req) {
    return req.User && (req.User.role === "admin" || req.User.role === "productManager");
}

// Check if user can review a product
export async function checkReviewEligibility(req, res) {
    try {
        const { productId } = req.params;
        if (!req.User || !req.User.email) return res.json({ canReview: false });

        const deliveredOrder = await Order.findOne({
            userEmail: req.User.email,
            status: "Delivered",
            "items.productId": productId
        });

        const existingReview = await Review.findOne({
            productId,
            userEmail: req.User.email
        });

        res.status(200).json({
            canReview: !!deliveredOrder && !existingReview,
            hasDelivered: !!deliveredOrder,
            alreadyReviewed: !!existingReview
        });
    } catch (error) {
        res.status(500).json({ message: "Error checking eligibility", error: error.message });
    }
}
