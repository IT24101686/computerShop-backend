import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    image: {
        type: String,
        default: "/images/default-category.png"
    },
    description: {
        type: String,
        default: ""
    },
    attributes: {
        type: [String],
        default: []
    },
    brands: {
        type: [String],
        default: []
    }
}, { timestamps: true });

const Category = mongoose.model("Category", CategorySchema);
export default Category;
