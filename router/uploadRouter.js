import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

import authorizeUser from "../lib/jwtMiddleware.js";

const uploadRouter = express.Router();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Set up Multer using Memory Storage (Very simple)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload Endpoint
uploadRouter.post("/", authorizeUser, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image uploaded" });
        }

        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;

        // Upload to Supabase Storage (Bucket name must be 'images')
        const { data, error } = await supabase.storage
            .from("images")
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            return res.status(500).json({ message: "Error uploading to Supabase", error: error.message });
        }

        // Generate the public URL
        const { data: publicUrlData } = supabase.storage
            .from("images")
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        res.status(200).json({
            message: "Image uploaded successfully",
            imageUrl: publicUrl
        });

    } catch (error) {
        res.status(500).json({ message: "Server Error during upload", error: error.message });
    }
});

export default uploadRouter;
