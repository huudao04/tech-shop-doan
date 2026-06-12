import express from 'express';
import { getCart, updateCart, clearCart } from '../controllers/cartController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authMiddleware, getCart);
router.put('/', authMiddleware, updateCart);
router.delete('/', authMiddleware, clearCart);

export default router;
