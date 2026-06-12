import express from 'express';
import {
  getAdminOrders,
  updateAdminOrder,
  exportOrdersExcel
} from '../controllers/orderController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/export-excel', authMiddleware, adminMiddleware, exportOrdersExcel);
router.get('/', authMiddleware, adminMiddleware, getAdminOrders);
router.put('/:id', authMiddleware, adminMiddleware, updateAdminOrder);

export default router;
