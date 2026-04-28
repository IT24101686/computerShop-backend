import Category from "../models/category.js";
import { isAdmin, hasAdminOrManagerAccess } from "./userController.js";

// ── Public: Get all categories ──
export async function getCategories(req, res) {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: "Error fetching categories", error: err.message });
    }
}

// ── Admin: Create category ──
export async function createCategory(req, res) {
    if (!hasAdminOrManagerAccess(req)) return res.status(403).json({ message: "Admin only" });

    try {
        const { name, description, image, attributes, brands } = req.body;
        const slug = name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");

        const existing = await Category.findOne({ slug });
        if (existing) return res.status(400).json({ message: "Category already exists" });

        const newCategory = new Category({ name, slug, description, image, attributes, brands });
        await newCategory.save();

        res.status(201).json({ message: "Category created successfully", category: newCategory });
    } catch (err) {
        res.status(500).json({ message: "Error creating category", error: err.message });
    }
}

// ── Admin: Delete category ──
export async function deleteCategory(req, res) {
    if (!hasAdminOrManagerAccess(req)) return res.status(403).json({ message: "Admin only" });

    try {
        const deleted = await Category.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Category not found" });
        res.json({ message: "Category deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting category", error: err.message });
    }
}

// ── Admin: Update category ──
export async function updateCategory(req, res) {
    if (!hasAdminOrManagerAccess(req)) return res.status(403).json({ message: "Admin only" });

    try {
        const { name, description, image, attributes, brands } = req.body;
        const slug = name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");

        const updated = await Category.findByIdAndUpdate(
            req.params.id,
            { name, slug, description, image, attributes, brands },
            { new: true }
        );

        if (!updated) return res.status(404).json({ message: "Category not found" });
        res.json({ message: "Category updated successfully", category: updated });
    } catch (err) {
        res.status(500).json({ message: "Error updating category", error: err.message });
    }
}
