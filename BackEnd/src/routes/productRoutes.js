import express from 'express';
import multer from 'multer';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchSuggest,
  importProductsExcel,
  matchImages,
  deleteProductsBulk
} from '../controllers/productController.js';
import { addProductReview } from '../controllers/reviewController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import upload from '../services/upload.js';

const router = express.Router();
const excelUpload = multer({ storage: multer.memoryStorage() });

router.post('/import-excel', authMiddleware, adminMiddleware, excelUpload.single('excelFile'), importProductsExcel);
router.post('/match-images', authMiddleware, adminMiddleware, upload.array('bulkImageFiles', 30), matchImages);
router.get('/search-suggest', searchSuggest);
router.get('/', getProducts);
router.post('/', authMiddleware, adminMiddleware, upload.array('image', 5), createProduct);
router.post('/:productId/reviews', authMiddleware, addProductReview);
router.get('/:id', getProductById);
router.put('/:id', authMiddleware, adminMiddleware, upload.array('image', 5), updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);
router.post('/bulk-delete', authMiddleware, adminMiddleware, deleteProductsBulk);

export default router;
