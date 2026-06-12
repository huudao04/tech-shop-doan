import express from 'express';
import { replyReview } from '../controllers/reviewController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/:id/discussion', authMiddleware, replyReview);

export default router;
