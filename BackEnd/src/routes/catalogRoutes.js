import express from 'express';
import { getCategories, getBrands } from '../controllers/productController.js';

const router = express.Router();

router.get('/categories', getCategories);
router.get('/brands', getBrands);

export default router;
