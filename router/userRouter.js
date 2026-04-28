import express from 'express';
import { 
    createUser, loginUser, getAllUsers, deleteUser, createStaffUser, 
    changeUserRole, updateUserProfile, forgotPassword, resetPassword, 
    registerStaffUser, getPendingStaff, approveStaffUser, getSupplierStats, 
    getDashboardOverview, toggleBlockUser, getUserInsights, 
    getAddresses, saveAddress, deleteAddress, logoutUser, getMe
} from "../controllers/userController.js";
import authorizeUser, { optionalAuth } from "../lib/jwtMiddleware.js";

const userRouter = express.Router();

userRouter.post("/register", createUser);              
userRouter.post("/register-staff", registerStaffUser); 
userRouter.post("/login", loginUser);                
userRouter.post("/logout", logoutUser);
userRouter.get("/me", optionalAuth, getMe);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password/:token", resetPassword);

// ── Protected (logged in users) ──
userRouter.put("/profile", authorizeUser, updateUserProfile); 

//only admin
userRouter.get("/pending-staff", authorizeUser, getPendingStaff);
userRouter.get("/", authorizeUser, getAllUsers);      
userRouter.delete("/:id", authorizeUser, deleteUser);     
userRouter.get("/:id/insights", authorizeUser, getUserInsights); // Comprehensive Customer Insights for Admin
userRouter.post("/create-staff", authorizeUser, createStaffUser);
userRouter.patch("/:id/approve", authorizeUser, approveStaffUser);  
userRouter.patch("/:id/role", authorizeUser, changeUserRole);   
userRouter.patch("/:id/block", authorizeUser, toggleBlockUser); 
userRouter.get("/addresses", authorizeUser, getAddresses);
userRouter.post("/addresses", authorizeUser, saveAddress);
userRouter.delete("/addresses/:addressId", authorizeUser, deleteAddress);

// Supplier & Dashboard Management (Admin)
userRouter.get("/suppliers/stats", authorizeUser, getSupplierStats);
userRouter.get("/dashboard/overview", authorizeUser, getDashboardOverview);

export default userRouter;
