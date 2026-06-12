import express from 'express';
import {
  register,
  login,
  googleLogin,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-password', authMiddleware, changePassword);
router.put('/profile', authMiddleware, updateProfile);

export default router;
