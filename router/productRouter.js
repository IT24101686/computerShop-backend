import express from "express";
import authorizeUser, { optionalAuth } from "../lib/jwtMiddleware.js";
import { createProduct, deleteProduct, updateProduct, getProducts, getProductById, getLowStockProducts } from "../controllers/productController.js";

const productRouter = express.Router();

productRouter.post("/", authorizeUser, createProduct)            // POST /products
productRouter.put("/:productid", authorizeUser, updateProduct)  // PUT  /products/:id
productRouter.delete("/:productid", authorizeUser, deleteProduct) // DELETE /products/:id
productRouter.get("/low-stock", authorizeUser, getLowStockProducts) // GET /products/low-stock
productRouter.get("/", optionalAuth, getProducts)              // GET  /products
productRouter.get("/:productid", optionalAuth, getProductById) // GET  /products/:id

export default productRouter;
