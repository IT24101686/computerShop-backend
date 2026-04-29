import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import dns from 'node:dns';


 dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Routers
import userRouter from './router/userRouter.js';
import productRouter from './router/productRouter.js';
import supplierRouter from './router/supplierRouter.js';
import inventoryRouter from './router/inventoryRouter.js';
import reviewRouter from './router/reviewRouter.js';
import orderRouter from './router/orderRouter.js';
import financeRouter from './router/financeRouter.js';
import uploadRouter from './router/uploadRouter.js';
import warrantyRouter from './router/warrantyRouter.js';
import categoryRouter from './router/categoryRouter.js';
import aiRouter from './router/aiRouter.js';
import notificationRouter from './router/notificationRouter.js';

// Middleware
// Load .env
dotenv.config();

const app = express();

// ── Middleware (must be before routes) ──
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-ID"],
}));
app.use(cookieParser());
app.use(express.json());

// ── MongoDB Connect ──
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log(" Connected to MongoDB");
        
        // Data Fix: Normalize legacy role names (if any)
        try {
            const result = await mongoose.connection.db.collection('users').updateMany(
                { role: { $in: ["inventory_manager", "inventory manager", "Inventory Manager"] } },
                { $set: { role: "inventoryManager" } }
            );
            if (result.modifiedCount > 0) {
                console.log(`✅ Normalized ${result.modifiedCount} legacy inventory manager roles!`);
            }
        } catch (e) {
            console.error("Data fix error:", e.message);
        }
    })
    .catch((err) => console.log("MongoDB connection error:", err.message));

// ── Public Routes (no auth needed) ──
app.use("/users", userRouter);

// ── Protected Routes (JWT auth handled per-router) ──
app.use("/products", productRouter);
app.use("/suppliers", supplierRouter);
app.use("/inventory", inventoryRouter);
app.use("/reviews", reviewRouter);
app.use("/orders", orderRouter);
app.use("/finance", financeRouter);
app.use("/upload", uploadRouter);
app.use("/warranty", warrantyRouter);
app.use("/categories", categoryRouter);
app.use("/ai", aiRouter);
app.use("/notifications", notificationRouter);

// ── Start Server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` Server is running on port ${PORT}`);
});