import express from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/notificationController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.patch('/read-all', authMiddleware, markAllNotificationsRead);
router.patch('/:id/read', authMiddleware, markNotificationRead);

export default router;
