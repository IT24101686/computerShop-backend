import express from "express";
import { creatproduct, deleteProduct,updateProduct,getProducts, getProductById} from "../controllers/productController.js";


const productRouter=express.Router();

productRouter.post("/",creatproduct)
productRouter.put("/:productid",updateProduct)
productRouter.delete("/:productid",deleteProduct)
productRouter.get("/",getProducts)
productRouter.get("/:productid",getProductById)



export default productRouter;