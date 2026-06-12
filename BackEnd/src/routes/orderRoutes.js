import express from 'express';
import {
  createOrder,
  getOrderStatuses,
  getPaymentMethods
} from '../controllers/orderController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/statuses', authMiddleware, getOrderStatuses);
router.get('/payment-methods', authMiddleware, getPaymentMethods);
router.post('/', authMiddleware, createOrder);

export default router;
