import express from "express";
import { getIncomeSummary, getExpenseSummary, getProfitSummary, getInvoice } from "../controllers/financeController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const financeRouter = express.Router();

// Admin Only - View financial summaries (Useful for a dashboard)
financeRouter.get("/income", authorizeUser, getIncomeSummary);
financeRouter.get("/expenses", authorizeUser, getExpenseSummary);
financeRouter.get("/profit-summary", authorizeUser, getProfitSummary);

// Admin & User - View order invoice (receipt)
financeRouter.get("/invoice/:orderId", authorizeUser, getInvoice);

export default financeRouter;
