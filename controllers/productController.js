import { isAdmin } from "./userController.js";
import Product from "../models/product.js";

export async function creatproduct(req,res){
    if(!isAdmin(req)){
        res.status(403).json({message:"Access denied. Admins only"});
        return;
    }

    try{
        const existingProduct=await Product.findOne({
            productid:req.body.productid
        });
        if(existingProduct){
            res.status(400).json({message:"Product with given id already exists"});
            return;
        }

        constdata={}
        data.productid=req.body.productid;
        if(req.body.name==null){
            res.status(400).json({message:"Product name is required"});
            return;
        }
        data.name=req.body.name;

        data.description=req.body.description || "";
        data.altnames=req.body.altnames || [];
        if(req.body.price==null){
            res.status(400).json({message:"Product price is required"});
            return;
        }
        data.price=req.body.price;
        data.labelledprice=req.body.labelledprice || req.body.price;
        data.category=req.body.category || "other";
        data.image=req.body.image || ["/images/default.png","/images/default.png"];
        data.isvisible=req.body.isvisible ;
        data.brand=req.body.brand || "Generic";
        data.model=req.body.model || "standard";

        const newProduct=new Product(data);
        await newProduct.save();
        res.status(201).json({message:"Product created successfully",product:newProduct});

    }catch(error){
        res.status(500).json({message:"Error creating  product",error:error.message});
        return;
    }        
}
export async function getProducts(req,res){
    try{
        if(isAdmin(req)){
            const products=await Product.find();
            res.json(products);
        }else{
         const products=await Product.find({isvisible:true});
        res.status(200).json(products);
        }
        
    }catch(error){
        res.status(500).json({message:"Error fetching products",error:error.message});
    }   
}

export async function deleteProduct(req,res){
    if(!isAdmin(req)){
        res.status(403).json({message:"Access denied. Admins only"});
        return;
    }
    try{
        const product=await Product.findOneAndDelete({productid:req.params.productid});
        if(!product){
            res.status(404).json({message:"Product not found"});
            return;
        }
        res.status(200).json({message:"Product deleted successfully",product:product});
    }catch(error){
        res.status(500).json({message:"Error deleting product",error:error.message});
    }

}
export async function updateProduct(req,res){
    if(!isAdmin(req)){
        res.status(403).json({message:"Access denied. Admins only"});
        return;
    }

    try{
        const product=await Product.findOne({productid:req.params.productid});
        if(!product){
            res.status(404).json({message:"Product not found"});
            return;
        }

        constdata={}
        if(req.body.name==null){
            res.status(400).json({message:"Product name is required"});
            return;
        }
        data.name=req.body.name;

        data.description=req.body.description || "";
        data.altnames=req.body.altnames || [];
        if(req.body.price==null){
            res.status(400).json({message:"Product price is required"});
            return;
        }
        data.price=req.body.price;
        data.labelledprice=req.body.labelledprice || req.body.price;
        data.category=req.body.category || "other";
        data.image=req.body.image || ["/images/default.png","/images/default.png"];
        data.isvisible=req.body.isvisible ;
        data.brand=req.body.brand || "Generic";
        data.model=req.body.model || "standard";
        await Product.updateOne({productid:req.params.productid},data);

        
        res.status(201).json({message:"Product updated successfully",product:product});

    }catch(error){
        res.status(500).json({message:"Error updating product",error:error.message});
        return;
    }        
}
export async function getProductById(req,res){
    try{
        const product=await Product.findOne({productid:req.params.productid});
        if(!product){
            res.status(404).json({message:"Product not found"});
            return;
        }
        if(!product.isvisible && !isAdmin(req)){
            res.status(403).json({message:"Access denied. Product is not visible"});
            return;
        }
        res.status(200).json(product);
    }catch(error){
        res.status(500).json({message:"Error fetching product",error:error.message});
    }
}