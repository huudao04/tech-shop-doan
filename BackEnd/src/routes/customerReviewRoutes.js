import express from 'express';
import { updateCustomerReview, deleteCustomerReview } from '../controllers/reviewController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.put('/:id', authMiddleware, updateCustomerReview);
router.delete('/:id', authMiddleware, deleteCustomerReview);

export default router;
