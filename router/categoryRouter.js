import express from "express";
import { getCategories, createCategory, deleteCategory, updateCategory } from "../controllers/categoryController.js";
import authorizeUser from "../lib/jwtMiddleware.js";

const categoryRouter = express.Router();

categoryRouter.get("/", getCategories);
categoryRouter.post("/", authorizeUser, createCategory);
categoryRouter.put("/:id", authorizeUser, updateCategory);
categoryRouter.delete("/:id", authorizeUser, deleteCategory);

export default categoryRouter;
