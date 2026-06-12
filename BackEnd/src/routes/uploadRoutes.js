import express from 'express';
import { uploadImages } from '../controllers/productController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import upload from '../services/upload.js';

const router = express.Router();

router.post('/', authMiddleware, adminMiddleware, upload.array('imageFiles', 8), uploadImages);

export default router;
