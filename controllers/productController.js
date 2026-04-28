import { isAdmin, hasAdminOrManagerAccess } from "./userController.js";
import Product from "../models/product.js";
import Setting from "../models/setting.js";
import { createAdminNotification } from "./notificationController.js";
import { checkAndSendLowStockAlert } from "./inventoryController.js";

export async function createProduct(req, res) {
    if (!hasAdminOrManagerAccess(req)) {
        res.status(403).json({ message: "Access denied. Admins only" });
        return;
    }

    try {
        const existingProduct = await Product.findOne({
            productid: req.body.productid
        });
        if (existingProduct) {
            res.status(400).json({ message: "Product with given id already exists" });
            return;
        }

        const data = {
            productid: req.body.productid,
            name: req.body.name,
            description: req.body.description || "",
            altnames: req.body.altnames || [],
            price: req.body.price,
            stock: req.body.stock || 0,
            labelledprice: req.body.labelledprice || req.body.price,
            category: req.body.category || "other",
            image: req.body.image || ["/images/default.png", "/images/default.png"],
            isvisible: req.body.isvisible !== false,
            brand: req.body.brand || "Generic",
            warranty: req.body.warranty || "No Warranty",
            model: req.body.model || "standard",
            supplier: req.body.supplier || "Unknown",
            attributes: req.body.attributes || []
        };

        const newProduct = new Product(data);
        await newProduct.save();

        // Create Admin Notification
        await createAdminNotification({
            title: "📦 New Product Added",
            message: `${newProduct.name} (SKU: ${newProduct.productid}) has been added to the catalog.`,
            type: "other",
            link: "/admin/products"
        });

        res.status(201).json({ message: "Product created successfully", product: newProduct });

    } catch (error) {
        res.status(500).json({ message: "Error creating product", error: error.message });
        return;
    }
}
export async function getProducts(req, res) {
    try {
        let query = {};

        // Visibility rules
        query.isDeleted = { $ne: true }; // Always hide deleted products
        if (!hasAdminOrManagerAccess(req)) {
            query.isvisible = true; // Only Admins/Managers see hidden products
        }

        // 1. Filtering by category
        if (req.query.category) {
            query.category = req.query.category;
        }

        // 2. Filtering by brand
        if (req.query.brand) {
            query.brand = { $regex: new RegExp(req.query.brand, "i") }; // Case-insensitive
        }

        // 3. Search by name or description
        if (req.query.search) {
            query.$or = [
                { name: { $regex: new RegExp(req.query.search, "i") } },
                { description: { $regex: new RegExp(req.query.search, "i") } }
            ];
        }

        // 4. Filtering by Price Range
        if (req.query.minPrice || req.query.maxPrice) {
            query.price = {};
            if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
            if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
        }

        // 5. Sorting
        let sortOption = { createdAt: -1 }; // Default: Recently added
        if (req.query.sortBy === "priceAsc") {
            sortOption = { price: 1 };
        } else if (req.query.sortBy === "priceDesc") {
            sortOption = { price: -1 };
        }

        // 6. Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(query).sort(sortOption).skip(skip).limit(limit),
            Product.countDocuments(query)
        ]);

        res.status(200).json({
            products,
            total,
            page,
            pages: Math.ceil(total / limit)
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
}

export async function deleteProduct(req, res) {
    if (!hasAdminOrManagerAccess(req)) {
        res.status(403).json({ message: "Access denied. Admins only" });
        return;
    }
    try {
        // Soft delete: update isDeleted flag instead of removing from DB
        const product = await Product.findByIdAndUpdate(req.params.productid, { isDeleted: true }, { new: true })
            || await Product.findOneAndUpdate({ productid: req.params.productid }, { isDeleted: true }, { new: true });
        
        if (!product) {
            res.status(404).json({ message: "Product not found" });
            return;
        }
        res.status(200).json({ message: "Product moved to archive successfully", product });
    } catch (error) {
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
}
export async function updateProduct(req, res) {
    if (!hasAdminOrManagerAccess(req)) {
        res.status(403).json({ message: "Access denied. Admins only" });
        return;
    }

    try {
        // Support both MongoDB _id and custom productid
        let product = await Product.findById(req.params.productid).catch(() => null)
            || await Product.findOne({ productid: req.params.productid });

        if (!product || product.isDeleted) {
            res.status(404).json({ message: "Product not found" });
            return;
        }

        // List of allowed fields to update
        const allowedFields = [
            'name', 'description', 'altnames', 'price', 'labelledprice', 
            'category', 'image', 'isvisible', 'brand', 'warranty', 
            'model', 'stock', 'supplier', 'attributes'
        ];

        const data = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                data[field] = req.body[field];
            }
        });

        const updatedProduct = await Product.findByIdAndUpdate(product._id, { $set: data }, { new: true });

        // Trigger Automatic Low Stock Alert if < 5
        checkAndSendLowStockAlert(updatedProduct.productid);

        res.status(200).json({ message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        res.status(500).json({ message: "Error updating product", error: error.message });
    }
}
export async function getProductById(req, res) {
    try {
        // Support both MongoDB _id and custom productid
        let product = await Product.findById(req.params.productid).catch(() => null)
            || await Product.findOne({ productid: req.params.productid });

        if (!product || product.isDeleted) {
            res.status(404).json({ message: "Product not found" });
            return;
        }
        if (!product.isvisible && !isAdmin(req)) {
            res.status(403).json({ message: "Product is not available" });
            return;
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: "Error fetching product", error: error.message });
    }
}

export async function getLowStockProducts(req, res) {
    try {
        if (!isAdmin(req) && req.User?.role !== "inventoryManager") {
            return res.status(403).json({ message: "Access denied" });
        }

        // Get dynamic thresholds from settings
        const settings = await Setting.findOne({ key: "lowStockThresholds" });
        const limits = settings ? settings.value : {
            Laptop: 5, Desktop: 10, Monitor: 8, Accessories: 20, Other: 5
        };

        // Find products matching their specific category thresholds
        // Sort by updatedAt descending so most recently low stock products appear first
        const lowStockProducts = await Product.find({
            isDeleted: { $ne: true },
            $or: [
                { category: "Laptop", stock: { $lt: limits.Laptop } },
                { category: "Desktop", stock: { $lt: limits.Desktop } },
                { category: "Monitor", stock: { $lt: limits.Monitor } },
                { category: "Accessories", stock: { $lt: limits.Accessories } },
                { category: { $nin: ["Laptop", "Desktop", "Monitor", "Accessories"] }, stock: { $lt: limits.Other } }
            ]
        }).sort({ updatedAt: -1 });

        res.status(200).json(lowStockProducts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching low stock products", error: error.message });
    }
}
