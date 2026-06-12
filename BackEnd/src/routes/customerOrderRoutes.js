import express from 'express';
import {
  getCustomerOrders,
  cancelCustomerOrder,
  receiveCustomerOrder
} from '../controllers/orderController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authMiddleware, getCustomerOrders);
router.patch('/:id/cancel', authMiddleware, cancelCustomerOrder);
router.patch('/:id/receive', authMiddleware, receiveCustomerOrder);

export default router;
