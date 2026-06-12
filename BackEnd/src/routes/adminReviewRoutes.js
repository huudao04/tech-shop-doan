import express from 'express';
import {
  getAdminRatings,
  getAdminReviews,
  createAdminReview,
  updateAdminReview,
  replyAdminReview,
  deleteAdminReview
} from '../controllers/reviewController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/ratings', authMiddleware, adminMiddleware, getAdminRatings);
router.get('/', authMiddleware, adminMiddleware, getAdminReviews);
router.post('/', authMiddleware, adminMiddleware, createAdminReview);
router.put('/:id', authMiddleware, adminMiddleware, updateAdminReview);
router.patch('/:id/reply', authMiddleware, adminMiddleware, replyAdminReview);
router.delete('/:id', authMiddleware, adminMiddleware, deleteAdminReview);

export default router;
