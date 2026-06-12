import express from 'express';
import {
  getDashboardStats,
  getReportsChart,
  exportReports,
  getCustomerStatuses,
  getCustomers,
  toggleCustomerStatus,
  trainAI
} from '../controllers/adminController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import aiTrainingUpload from '../services/aiTrainingUpload.js';

const router = express.Router();

router.get('/dashboard-stats', authMiddleware, adminMiddleware, getDashboardStats);
router.get('/reports-chart', authMiddleware, adminMiddleware, getReportsChart);
router.get('/export-reports', authMiddleware, adminMiddleware, exportReports);
router.get('/customers/statuses', authMiddleware, adminMiddleware, getCustomerStatuses);
router.get('/customers', authMiddleware, adminMiddleware, getCustomers);
router.patch('/customers/:id/toggle-status', authMiddleware, adminMiddleware, toggleCustomerStatus);
router.post('/ai-train', authMiddleware, adminMiddleware, aiTrainingUpload.single('file'), trainAI);

export default router;
