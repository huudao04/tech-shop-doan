import express from 'express';
import { 
  createVoucher, 
  getAdminVouchers, 
  updateVoucher, 
  deleteVoucher,
  checkVoucher 
} from '../controllers/voucherController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Route cho Client check mã lúc checkout (Đã làm trước đó)
router.post('/check', authMiddleware, checkVoucher);

// Nhóm các Route CRUD dành riêng cho quyền Admin (CMS)
router.get('/', authMiddleware, adminMiddleware, getAdminVouchers);       // Tìm kiếm & Lấy danh sách mã
router.post('/', authMiddleware, adminMiddleware, createVoucher);         // Tạo mã mới
router.put('/:id', authMiddleware, adminMiddleware, updateVoucher);       // Sửa mã theo ID
router.delete('/:id', authMiddleware, adminMiddleware, deleteVoucher);    // Xóa mã theo ID

export default router;