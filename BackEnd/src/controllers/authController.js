import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import transporter from '../config/mailer.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email này đã được sử dụng!' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword, role: 'customer' });
    await newUser.save();

    res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng ký' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa! Vui lòng liên hệ Admin để được hỗ trợ.'
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng nhập' });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { email, name } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({ name, email, password: hashedPassword, role: 'customer' });
      await user.save();
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa!' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng nhập Google' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác!' });

    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đổi mật khẩu' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const rawName = req.body?.name;
    const rawEmail = req.body?.email;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ họ tên và email!' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Email không đúng định dạng!' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });

    const emailOwner = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (emailOwner) return res.status(400).json({ success: false, message: 'Email này đã được sử dụng!' });

    user.name = name;
    user.email = email;
    await user.save();

    return res.json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công!',
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật thông tin' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'Email này không tồn tại trên hệ thống!' });

    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
    const frontendOrigin = req.get('origin') || 'http://localhost:5173';
    const resetLink = `${frontendOrigin}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"TechShop Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '[TechShop] Khôi phục mật khẩu tài khoản của bạn',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Xin chào ${user.name},</h2>
          <p>Bạn đã yêu cầu khôi phục mật khẩu tại TechShop.</p>
          <p>Vui lòng nhấn vào nút bấm bên dưới để tiến hành tạo mật khẩu mới. Đường dẫn này có hiệu lực trong vòng 15 phút.</p>
          <a href="${resetLink}" style="display: inline-block; background: #1677ff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a>
          <p style="margin-top: 20px; font-size: 12px; color: #777;">Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Liên kết đặt lại mật khẩu đã được gửi tới email của bạn!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý quên mật khẩu' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Mã xác thực không hợp lệ!' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Liên kết đã hết hạn hoặc không hợp lệ!' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng!' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Đặt lại mật khẩu mới thành công! Vui lòng đăng nhập lại.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật mật khẩu mới' });
  }
};
