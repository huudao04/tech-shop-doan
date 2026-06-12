import 'dotenv/config';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Không tìm thấy token, quyền truy cập bị từ chối!' });
  if (!JWT_SECRET) return res.status(500).json({ message: 'JWT_SECRET chưa được cấu hình.' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(verified.id);
    if (!user) return res.status(401).json({ message: 'Tài khoản không tồn tại.' });
    if (user.isActive === false) return res.status(401).json({ message: 'Tài khoản đã bị khóa.' });

    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

export const adminMiddleware = (req, res, next) => {
  if (req.user?.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Từ chối truy cập! Bạn không phải Admin.' });
  }
};
