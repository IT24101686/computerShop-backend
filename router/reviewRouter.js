import express from "express";
import { addReview, getProductReviews, deleteReview, getAllReviews, checkReviewEligibility, updateReview, replyToReview } from "../controllers/reviewController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const reviewRouter = express.Router();

// Admin: Get all reviews
reviewRouter.get("/all", authorizeUser, getAllReviews);

// Reply to a review
reviewRouter.post("/reply/:id", authorizeUser, replyToReview);

// Check if user can review a product
reviewRouter.get("/eligibility/:productId", authorizeUser, checkReviewEligibility);

// Update a review
reviewRouter.put("/:id", authorizeUser, updateReview);

// Get reviews for a specific product
reviewRouter.get("/:productId", getProductReviews);

// Add a new review (Must be logged in)
reviewRouter.post("/", authorizeUser, addReview);

// Delete a review (Only the creator or admin can do this)
reviewRouter.delete("/:id", authorizeUser, deleteReview);

export default reviewRouter;
