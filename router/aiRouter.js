import express from 'express';
import { 
    generateCategoryDescription, 
    generateProductDescription, 
    generateCategoryImage 
} from '../controllers/aiController.js';
import authorizeUser from '../lib/jwtMiddleware.js';

const router = express.Router();

// AI routes protected by JWT
router.get('/category-description', authorizeUser, generateCategoryDescription);
router.get('/product-description', authorizeUser, generateProductDescription);
router.get('/category-image', authorizeUser, generateCategoryImage);

export default router;
