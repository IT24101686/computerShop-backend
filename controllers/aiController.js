import Groq from "groq-sdk";
import Replicate from "replicate";
import axios from "axios";

/**
 * AI Controller for Category Narratives - Powered by Groq (LLaMA)
 */
export const generateCategoryDescription = async (req, res) => {
    try {
        const { name } = req.query;
        console.log(`[AI-CAT] Request received for: "${name}"`);

        if (!name) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: "AI Services Unavailable: Key not configured in .env" });
        }

        const groq = new Groq({ apiKey });

        const prompt = `Write a professional 2-4 word sophisticated category description for "${name}". Sound premium and luxurious. Respond ONLY with the description text itself.`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional e-commerce copywriter. Only output the raw description text.",
                },
                { role: "user", content: prompt },
            ],
            model: "llama-3.1-8b-instant",
            max_tokens: 50,
            temperature: 0.7,
        });

        const text = completion.choices[0]?.message?.content?.trim();
        res.status(200).json({ success: true, description: text });
    } catch (error) {
        console.error("[AI-CAT] Groq AI Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * AI Controller for Product Narratives - Powered by Groq (LLaMA)
 */
export const generateProductDescription = async (req, res) => {
    try {
        const { name } = req.query;
        console.log(`[AI-PROD] Request received for: "${name}"`);

        if (!name) {
            return res.status(400).json({ success: false, message: "Product name is required" });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: "AI Services Unavailable: Key not configured in .env" });
        }

        const groq = new Groq({ apiKey });

        const prompt = `Write a creative, vibrant, and highly promotional e-commerce product description for "${name}". 
        CRITICAL: Length MUST be between 30 to 35 words. 
        TONE: Premium, stylish, and innovative.
        Respond ONLY with the description text itself.`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional e-commerce copywriter. Follow word count instructions strictly (30-35 words). Never use introductory phrases like 'Here is your description'. Only output the raw description text.",
                },
                { role: "user", content: prompt },
            ],
            model: "llama-3.1-8b-instant",
            max_tokens: 150,
            temperature: 0.8,
        });

        const text = completion.choices[0]?.message?.content?.trim();
        res.status(200).json({ success: true, description: text });
    } catch (error) {
        console.error("[AI-PROD] Groq AI Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * AI Image Generation - Powered by Replicate (flux-schnell model)
 */
export const generateCategoryImage = async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }

        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) {
            return res.status(500).json({
                success: false,
                message: "REPLICATE_API_TOKEN is not configured.",
            });
        }

        const replicate = new Replicate({ auth: token });

        const prompt = `professional e-commerce product category banner for "${name}", clean white studio background, high quality commercial photography, minimalist, 4k`;

        const output = await replicate.run(
            "black-forest-labs/flux-schnell",
            {
                input: {
                    prompt,
                    num_outputs: 1,
                    aspect_ratio: "16:9",
                    output_format: "webp",
                    output_quality: 90,
                },
            }
        );

        let imageUrl = Array.isArray(output) ? output[0] : output;

        const imgResponse = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
        });

        const contentType = imgResponse.headers["content-type"] || "image/webp";
        const base64 = Buffer.from(imgResponse.data).toString("base64");
        const dataUrl = `data:${contentType};base64,${base64}`;

        res.status(200).json({
            success: true,
            imageUrl: dataUrl,
        });
    } catch (error) {
        console.error("[ImageGen] Replicate Error:", error.message);
        res.status(500).json({
            success: false,
            message: `Image generation failed: ${error.message}`,
        });
    }
};
