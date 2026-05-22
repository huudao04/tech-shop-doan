import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mongoose from 'mongoose';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SePayPgClient } from 'sepay-pg-node';

const JWT_SECRET = 'TECH_SHOP_SUPER_SECRET_KEY_2026';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const OLLAMA_API = 'http://localhost:11434/api/generate'; 

// Khởi tạo client SePay
const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: 'SP-LIVE-NH783B44',   
  secret_key: 'spsk_live_FJhRQ7N56cZqs2CV78jUYt8GsbfSx8Wi'  
});
// CẤU HÌNH TRANSPORTER GỬI EMAIL (Cần lấy Mật khẩu ứng dụng - App Password của Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'YOUR_EMAIL@gmail.com', // Thay bằng Gmail của shop
    pass: 'YOUR_APP_PASSWORD'     // Thay bằng Mật khẩu ứng dụng 16 ký tự của Gmail
  }
});
// TẠO SERVER HTTP GẮN SOCKET.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});
// QUẢN LÝ KẾT NỐI REAL-TIME
io.on('connection', (socket) => {
  console.log(`🔌 Thiết bị kết nối: ${socket.id}`);

  // Khi user/admin đăng nhập, họ sẽ tham gia vào phòng (Room) tương ứng với Role hoặc UserId của họ
  socket.on('join_room', (data) => {
    socket.join(data.role); // Gửi vào room 'admin' hoặc 'customer'
    socket.join(data.userId); // Hoặc room riêng theo ID của từng user
    console.log(`👤 Người dùng ${data.userId} với quyền [${data.role}] đã vào phòng.`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Thiết bị ngắt kết nối');
  });
});
// ==========================================
//             1. KẾT NỐI MONGODB
// ==========================================
mongoose.connect('mongodb://localhost:27017/tech_shop')
  .then(() => console.log('✅ Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// ==========================================
//             2. ĐỊNH NGHĨA SCHEMAS
// ==========================================

// Schema Tài khoản
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Schema Sản phẩm
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  category: { type: String },
  brand: { type: String },
  stock: { type: Number, default: 0 },
  image: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// Schema Danh mục
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String }
});
const Category = mongoose.model('Category', categorySchema);

// Schema Thương hiệu
const brandSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String }
});
const Brand = mongoose.model('Brand', brandSchema);

// Schema Đánh giá nâng cấp với chuỗi thảo luận
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Liên kết tài khoản khách hàng
  name: { type: String, required: true }, 
  rating: { type: Number, required: true, min: 1, max: 5 }, 
  comment: { type: String, required: true }, 
  // Mảng lưu lịch sử trao đổi qua lại giữa khách và các quản trị viên/khách khác
  discussions: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      role: { type: String, required: true }, // 'customer' hoặc 'admin'
      comment: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

// Schema Đơn hàng
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  shippingAddress: { type: String, required: true },
  provinceFilter: { type: String, default: "Khác" },
  paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER'], required: true },
  paymentStatus: { type: String, enum: ['Chờ thanh toán', 'Đã thanh toán', 'Thanh toán thất bại'], default: 'Chờ thanh toán' },
  status: { 
    type: String, 
    enum: ['Chờ xác nhận', 'Đang đóng gói', 'Đang giao', 'Đã nhận', 'Hủy đơn hàng'], 
    default: 'Chờ xác nhận' 
  },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true }
    }
  ],
  totalPrice: { type: Number, required: true },
  qrCodeUrl: { type: String },
  paymentUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Schema Thông báo (Notification)
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'general' },
  isRead: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);
// ==========================================
//             3. CẤU HÌNH MIDDLEWARES
// ==========================================

// Middleware kiểm tra token hợp lệ
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Không tìm thấy token, quyền truy cập bị từ chối!' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

// Middleware kiểm tra quyền Admin
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Từ chối truy cập! Bạn không phải Admin.' });
  }
};

// Cấu hình lưu trữ ảnh Upload bằng Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), '../frontend/public/images');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// [ADMIN] Upload ảnh sản phẩm cho màn quản lý sản phẩm
app.post('/api/upload', authMiddleware, adminMiddleware, upload.array('imageFiles', 8), async (req, res) => {
  try {
    const fileNames = (req.files || []).map(file => file.filename);
    res.json({ success: true, fileNames });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể upload ảnh sản phẩm' });
  }
});

// [USER & ADMIN] API Đổi mật khẩu
app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id; // Lấy ID từ token đã verify qua authMiddleware

    // 1. Tìm người dùng trong cơ sở dữ liệu
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    // 2. Kiểm tra mật khẩu cũ xem có khớp không
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác!' });
    }

    // 3. Kiểm tra mật khẩu mới trùng mật khẩu cũ không (Optional nâng cao)
    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    // 4. Mã hóa (Hash) mật khẩu mới và lưu lại
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đổi mật khẩu' });
  }
});
// ==========================================
//             4. API AUTHENTICATION
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email này đã được sử dụng!' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'customer'
    });

    await newUser.save();
    res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng ký' });
  }
});

app.post('/api/auth/login', async (req, res) => {
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng nhập' });
  }
});

// Thêm API xử lý Đăng nhập Google
app.post('/api/auth/google-login', async (req, res) => {
  try {
    const { email, name } = req.body;

    // Tìm xem email này đã tồn tại trong DB chưa
    let user = await User.findOne({ email });

    if (!user) {
      // Nếu chưa có, tạo tài khoản mới với mật khẩu ngẫu nhiên (hoặc rỗng)
      const salt = await bcrypt.genSalt(10);
      const randomPassword = Math.random().toString(36).slice(-8); // Tạo chuỗi ngẫu nhiên công khai ngầm
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({
        name,
        email,
        password: hashedPassword,
        role: 'customer'
      });
      await user.save();
    }

    if (user.isActive === false) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản của bạn đã bị khóa!' 
      });
    }

    // Tạo JWT token cho hệ thống TechShop của bạn
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống khi đăng nhập Google' });
  }
});
// API 1: Yêu cầu quên mật khẩu - Gửi Link về Email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Email này không tồn tại trên hệ thống!' });
    }

    // Tạo token khôi phục mật khẩu có thời hạn 15 phút
    const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
    
    // Đường dẫn trỏ tới màn hình Reset Password ở Frontend (mặc định Port 5173 của Vite/React)
    const frontendOrigin = req.get('origin') || 'http://localhost:5173';
    const resetLink = `${frontendOrigin}/reset-password?token=${resetToken}`;

    // Cấu hình nội dung email gửi đi
    const mailOptions = {
      from: '"TechShop Support" <YOUR_EMAIL@gmail.com>',
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
});

// API 2: Thực hiện Đặt lại mật khẩu mới từ link Email
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Mã xác thực không hợp lệ!' });
    }

    // Xác thực token xem có hợp lệ hoặc hết hạn 15 phút chưa
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Liên kết đã hết hạn hoặc không hợp lệ!' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng!' });
    }

    // Mã hóa mật khẩu mới và cập nhật vào DB
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Đặt lại mật khẩu mới thành công! Vui lòng đăng nhập lại.' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật mật khẩu mới' });
  }
});
// ==========================================
//             5. API PRODUCTS (PUBLIC & ADMIN)
// ==========================================

// Lấy danh sách sản phẩm (Public)
// API lấy danh sách sản phẩm (Tích hợp thêm bộ lọc khoảng giá Min - Max)
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, brand, minPrice, maxPrice } = req.query;
    let query = {};

    // 1. Lọc theo tên sản phẩm
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // 2. Lọc theo Danh mục
    if (category) {
      query.category = { $in: category.split(',') };
    }

    // 3. Lọc theo Thương hiệu
    if (brand) {
      query.brand = { $in: brand.split(',') };
    }

    // 4. Lọc theo khoảng giá (Ép kiểu sang dạng số nguyên thực tế)
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        query.price.$gte = parseInt(minPrice);
      }
      if (maxPrice) {
        query.price.$lte = parseInt(maxPrice);
      }
    }

    // Truy vấn database và sắp xếp sản phẩm mới nhất lên đầu
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách sản phẩm' });
  }
});
app.get('/api/products/search-suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // Hàm chuyển đổi chuỗi tiếng Việt thành biểu thức regex hỗ trợ cả có dấu và không dấu
    const makeVietnameseRegex = (keyword) => {
      let str = keyword.toLowerCase().trim();
      str = str.replace(/[aàáạảãâầấậẩẫăằắặẳẵ]/g, '[aàáạảãâầấậẩẫăằắặẳẵ]');
      str = str.replace(/[eèéẹẻẽêềếệểễ]/g, '[eèéẹẻẽêềếệểễ]');
      str = str.replace(/[iìíịỉĩ]/g, '[iìíịỉĩ]');
      str = str.replace(/[oòóọỏõôồốộổỗơờớợởỡ]/g, '[oòóọỏõôồốộổỗơờớợởỡ]');
      str = str.replace(/[uùúụủũưừứựửữ]/g, '[uùúụủũưừứựửữ]');
      str = str.replace(/[yỳýỵỷỹ]/g, '[yỳýỵỷỹ]');
      str = str.replace(/[dđ]/g, '[dđ]');
      return new RegExp(str, 'i'); // 'i' giúp không phân biệt hoa thường
    };

    const searchRegex = makeVietnameseRegex(q);

    const products = await Product.find({ name: { $regex: searchRegex } })
      .select('_id name price image') 
      .limit(10);

    res.json(products);
  } catch (error) {
    console.error('Lỗi tìm kiếm gợi ý:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
});
// Lấy danh mục động (Public)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find({}, 'name slug').sort({ name: 1 }).lean();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải danh mục' });
  }
});

// Lấy thương hiệu động (Public)
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await Brand.find({}, 'name slug').sort({ name: 1 }).lean();
    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thương hiệu' });
  }
});

// Chi tiết 1 sản phẩm kèm reviews (Public)
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    const reviews = await Review.find({ productId: new mongoose.Types.ObjectId(req.params.id) }).sort({ createdAt: -1 });
    res.json({ product, reviews });
  } catch (error) {
    res.status(500).json({ message: "ID sản phẩm không hợp lệ hoặc lỗi hệ thống" });
  }
});

// [ADMIN] Thêm sản phẩm
app.post('/api/products', authMiddleware, adminMiddleware, upload.array('image', 5), async (req, res) => {
  try {
    const { name, price, description, category, brand, stock, image } = req.body;
    const fileNames = Array.isArray(image)
      ? image
      : image
        ? [image]
        : (req.files ? req.files.map(file => file.filename) : []);

    const newProduct = new Product({
      name, price: Number(price), description, category, brand, stock: Number(stock), image: fileNames
    });
    await newProduct.save();
    res.status(201).json({ success: true, message: "Thêm sản phẩm thành công!", product: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể thêm sản phẩm" });
  }
});

// [ADMIN] Sửa sản phẩm
app.put('/api/products/:id', authMiddleware, adminMiddleware, upload.array('image', 5), async (req, res) => {
  try {
    const { name, price, description, category, brand, stock, image } = req.body;
    let updateData = { name, price: Number(price), description, category, brand, stock: Number(stock) };
    if (Array.isArray(image)) {
      updateData.image = image;
    } else if (image) {
      updateData.image = [image];
    } else if (req.files && req.files.length > 0) {
      updateData.image = req.files.map(file => file.filename);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedProduct) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    res.json({ success: true, message: "Cập nhật thành công!", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật sản phẩm" });
  }
});

// [ADMIN] Xóa sản phẩm
app.delete('/api/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });

    const uploadPath = path.join(process.cwd(), '../frontend/public/images');
    const images = Array.isArray(deletedProduct.image) ? deletedProduct.image : [];

    for (const imageName of images) {
      const fileName = path.basename(imageName);
      const filePath = path.join(uploadPath, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ success: true, message: "Xóa sản phẩm thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể xóa sản phẩm" });
  }
});

// ==========================================
//             6. API REVIEWS
// ==========================================

// Gửi đánh giá mới (Yêu cầu đăng nhập)
app.post('/api/products/:productId/reviews', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Lấy thông tin người dùng từ DB để điền tên tự động công khai
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });

    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(req.params.productId),
      userId: userId,
      name: user.name,
      rating: Number(rating),
      comment
    });

    await newReview.save();
    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể gửi đánh giá" });
  }
});

// KHÁCH HÀNG: Sửa đánh giá của chính mình
app.put('/api/customer/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findOne({ _id: req.params.id, userId: req.user.id });

    if (!review) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền sửa hoặc đánh giá không tồn tại!" });
    }

    review.rating = Number(rating);
    review.comment = comment;
    await review.save();

    res.json({ success: true, message: "Cập nhật đánh giá thành công!", review });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi sửa đánh giá" });
  }
});

// KHÁCH HÀNG: Xóa đánh giá của chính mình
app.delete('/api/customer/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

    if (!review) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa hoặc đánh giá không tồn tại!" });
    }

    res.json({ success: true, message: "Xóa đánh giá thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi xóa đánh giá" });
  }
});

// [PUBLIC] Phản hồi/Trao đổi vào chuỗi thảo luận (Dành cho cả Admin lẫn Customer tương tác qua lại)
app.post('/api/reviews/:id/discussion', authMiddleware, async (req, res) => {
  try {
    const { comment } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Tài khoản không tồn tại" });

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Đánh giá gốc không tồn tại" });

    // Đẩy phản hồi mới vào mảng thảo luận qua lại
    const discussionItem = {
      userId: user._id,
      name: user.name,
      role: user.role, // 'admin' hoặc 'customer'
      comment,
      createdAt: new Date()
    };

    review.discussions.push(discussionItem);
    await review.save();
    if (user.role === 'admin') {
      io.to(review.userId.toString()).emit('new_notification', {
        title: 'Phản hồi mới từ Admin 💬',
        message: `Quản trị viên đã trả lời đánh giá của bạn tại sản phẩm.`,
        type: 'discussion'
      });
      await Notification.create({ userId: review.userId, title: 'Phản hồi mới từ Admin 💬', message: `Quản trị viên đã trả lời đánh giá của bạn tại sản phẩm.`, type: 'discussion', meta: { reviewId: review._id, productId: review.productId } });
    } else {
      io.to('admin').emit('new_notification', {
        title: 'Thảo luận mới từ Khách 💬',
        message: `Khách hàng ${user.name} vừa phản hồi trong chuỗi thảo luận đánh giá.`,
        type: 'discussion'
      });
      await Notification.create({ title: 'Thảo luận mới từ Khách 💬', message: `Khách hàng ${user.name} vừa phản hồi trong chuỗi thảo luận đánh giá.`, type: 'discussion', meta: { reviewId: review._id, productId: review.productId, fromUserId: user._id } });
    }
    res.json({ success: true, message: "Đã gửi phản hồi trao đổi!", review });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi gửi thảo luận" });
  }
});

// 1. API ĐỘC LẬP: Quét trực tiếp dữ liệu từ collection 'ratings' đã tạo tay trong Compass
app.get('/api/admin/reviews/ratings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ratings = await mongoose.connection.db
      .collection('ratings')
      .find({})
      .sort({ value: -1 })
      .toArray();
    res.json({ success: true, data: ratings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi không thể đọc dữ liệu số sao!" });
  }
});

// 2. API DANH SÁCH REVIEW: Cập nhật bộ lọc nâng cao tích hợp xử lý tham số gửi lên
app.get('/api/admin/reviews', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { searchCustomer, productId, rating, date } = req.query;
    let query = {};

    // Lọc theo tên khách hàng (Quét text không phân biệt hoa thường)
    if (searchCustomer) {
      query.name = { $regex: searchCustomer, $options: 'i' };
    }

    // Lọc chính xác theo Sản phẩm
    if (productId) {
      query.productId = productId;
    }

    // Lọc theo số sao (Ép chuỗi string nhận từ query params thành số nguyên)
    if (rating) {
      query.rating = parseInt(rating);
    }

    // Lọc Ngày gửi thông minh: Bao trọn gói từ lúc sang ngày mới đến đêm muộn hôm đó
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    // Tiến hành truy vấn liên kết lấy tên sản phẩm hiển thị, xếp đánh giá mới nhất lên đầu
    const reviews = await Review.find(query)
      .populate('productId', 'name image')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi tải danh sách đánh giá!" });
  }
});

// [ADMIN] Chủ động thêm đánh giá điều hướng (Fake Review)
app.post('/api/admin/reviews', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId, name, rating, comment, reply } = req.body;
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(productId), name, rating: Number(rating), comment, reply: reply || ""
    });
    await newReview.save();
    const populatedReview = await Review.findById(newReview._id).populate('productId', 'name image');
    res.status(201).json({ success: true, message: "Thêm đánh giá thành công!", review: populatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể thêm đánh giá" });
  }
});

// [ADMIN] Sửa nội dung đánh giá có sẵn
app.put('/api/admin/reviews/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId, name, rating, comment } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { productId: new mongoose.Types.ObjectId(productId), name, rating: Number(rating), comment },
      { new: true }
    ).populate('productId', 'name image');
    if (!updatedReview) return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
    res.json({ success: true, message: "Cập nhật thành công!", review: updatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật" });
  }
});

// [ADMIN] Phản hồi đánh giá
app.patch('/api/admin/reviews/:id/reply', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { reply } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(req.params.id, { reply }, { new: true }).populate('productId', 'name image');
    res.json({ success: true, message: "Gửi phản hồi thành công!", review: updatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể gửi phản hồi" });
  }
});

// [ADMIN] Xóa đánh giá
app.delete('/api/admin/reviews/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    if (!deletedReview) return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi" });
    res.json({ success: true, message: "Xóa đánh giá thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể thực hiện" });
  }
});

// ==========================================
//             7. API ORDERS & SEPAY
// ==========================================

// Đặt hàng mới (Public)
// Hàm phụ để chuẩn hóa chuỗi phục vụ việc so khớp địa chỉ
const removeVietnameseTones = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { customerName, phoneNumber, shippingAddress, paymentMethod, items, totalPrice } = req.body;
    const userId = req.user.id;

    // --- LOGIC TRÍCH XUẤT TỈNH/THÀNH TỪ ĐỊA CHỈ KHÁCH GÕ ---
    let matchedProvinceName = "Khác";
    const db = mongoose.connection;
    // Lấy danh sách tỉnh thành từ collection provinces trong DB của bạn
    const provincesList = await db.collection('provinces').find({}).toArray();
    
    // Chuẩn hóa chuỗi địa chỉ khách nhập thành chữ thường không dấu
    const cleanShippingAddress = removeVietnameseTones(shippingAddress);

    for (const prov of provincesList) {
      const cleanProvName = removeVietnameseTones(prov.name); // Ví dụ: "Thanh Hóa" -> "thanh hoa"
      
      // Kiểm tra xem trong chuỗi khách gõ có chứa tên tỉnh thành đó không
      if (cleanShippingAddress.includes(cleanProvName)) {
        matchedProvinceName = prov.name; // Gán lại tên tỉnh chuẩn có dấu (Ví dụ: "Thanh Hóa")
        break; // Tìm thấy thì dừng vòng lặp luôn
      }
    }
    // ----------------------------------------------------

    // Kiểm tra kho hàng (Giữ nguyên logic cũ của bạn)
    for (const item of items) {
      const product = await Product.findById(item.productId); 
      if (!product || product.stock < item.quantity) return res.status(400).json({ success: false, message: `Sản phẩm không đủ hàng!` });
    }

    const orderId = 'DH' + Math.floor(100000 + Math.random() * 900000);
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
    }

    const newOrder = new Order({
      orderId, 
      userId, 
      customerName, 
      phoneNumber, 
      shippingAddress, // Lưu nguyên văn: "phúc đức, quảng tiến, Sầm sơn, thanh hóa"
      provinceFilter: matchedProvinceName, // Tự động lưu: "Thanh Hóa" (dùng để lọc và xuất excel sau này)
      paymentMethod,
      items: items.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      totalPrice,
      status: 'Chờ xác nhận'
    });

    let paymentGateway = null;
    if (paymentMethod === 'BANK_TRANSFER') {
      const frontendOrigin = req.get('origin') || 'http://localhost:5173';
      const checkoutFields = sepayClient.checkout.initOneTimePaymentFields({
        operation: 'PURCHASE', payment_method: 'BANK_TRANSFER', order_invoice_number: orderId,
        order_amount: Number(totalPrice), currency: 'VND', order_description: `Thanh toán đơn hàng ${orderId}`,
        success_url: `${frontendOrigin}/my-orders?status=success&orderId=${orderId}`,
        cancel_url: `${frontendOrigin}/my-orders?status=cancel&orderId=${orderId}`
      });
      const checkoutUrl = sepayClient.checkout.initCheckoutUrl();
      newOrder.paymentUrl = checkoutUrl;
      paymentGateway = { checkoutUrl, fields: checkoutFields };
    }

    await newOrder.save();
    
    io.to('admin').emit('new_notification', {
      title: 'Đơn hàng mới! 🛒',
      message: `Khách hàng ${customerName} vừa đặt đơn hàng ${orderId}.`,
      type: 'order'
    });
    await Notification.create({ title: 'Đơn hàng mới! 🛒', message: `Khách hàng ${customerName} vừa đặt đơn hàng ${orderId}.`, type: 'order', meta: { orderId } });
    return res.status(201).json({ success: true, order: newOrder, paymentGateway });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý đơn hàng!" });
  }
});
// 1. API CHO ADMIN: LỌC TỔNG HỢP (SỬA LỖI THÀNH PHỐ + THÊM BỘ LỌC NGÀY)
app.get('/api/admin/orders', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search, status, paymentMethod, province, date } = req.query;
    let query = {};

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    // 🌟 SỬA LỖI THÀNH PHỐ: Quét trực tiếp vào chuỗi shippingAddress gốc, không phân biệt hoa thường
    if (province) {
      query.shippingAddress = { $regex: province, $options: 'i' };
    }

    // 🌟 BỘ LỌC NGÀY THÔNG MINH: Bắt trọn vẹn từ 00:00:00 đến 23:59:59 của ngày chọn
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi tải đơn hàng" });
  }
});

// 2. API CHO USER: ĐỒNG BỘ 100% BỘ LỌC GIỐNG ADMIN
app.get('/api/customer/orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, status, paymentMethod, province, date } = req.query;
    
    let query = { userId }; // Ép điều kiện bảo mật của User

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    // Sửa lỗi lọc thành phố cho User giống Admin
    if (province) {
      query.shippingAddress = { $regex: province, $options: 'i' };
    }

    // Đồng bộ lọc ngày cho User
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (search) {
      query.orderId = { $regex: search, $options: 'i' };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể tải danh sách đơn hàng" });
  }
});
// 1. API lấy danh sách các Trạng thái đơn hàng
app.get('/api/orders/statuses', authMiddleware, (req, res) => {
  try {
    const statuses = Order.schema.path('status').enumValues;
    res.json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể lấy danh sách trạng thái" });
  }
});

// 2. API lấy danh sách các Phương thức thanh toán (Phương thức ví)
app.get('/api/orders/payment-methods', authMiddleware, (req, res) => {
  try {
    const paymentMethods = Order.schema.path('paymentMethod').enumValues;
    res.json({ success: true, data: paymentMethods });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể lấy danh sách phương thức thanh toán" });
  }
});
// Webhook SePay nhận tín hiệu tự động chuyển khoản (Public)
app.post('/api/sepay-webhook', async (req, res) => {
  try {
    const transaction = sepayClient.verifyWebhookToken(req.body);
    if (!transaction) return res.status(400).json({ message: "Mã bảo mật webhook không hợp lệ" });

    const { code, amount } = transaction; 
    const order = await Order.findOne({ orderId: code });
    if (!order || order.paymentStatus === 'PAID') return res.json({ success: true });

    if (amount >= order.totalPrice) {
      order.paymentStatus = 'Chờ thanh toán';
      order.status = 'Chờ xác nhận'; 
      await order.save();
    }
    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xử lý webhook" });
  }
});
// =========================================================================
// BỔ SUNG API CHO KHÁCH HÀNG THAO TÁC (Tự hủy đơn & Xác nhận đã nhận hàng)
// =========================================================================

// Khách hàng hủy đơn (Chỉ được hủy khi đang "Chờ xác nhận")
app.patch('/api/customer/orders/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });

    if (order.status !== 'Chờ xác nhận') {
      return res.status(400).json({ success: false, message: "Đơn hàng đã được xử lý, bạn không thể tự hủy!" });
    }

    // Hoàn lại số lượng tồn kho sản phẩm
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    order.status = 'Hủy đơn hàng';
    if (order.paymentStatus === 'PENDING') order.paymentStatus = 'FAILED';
    await order.save();
    io.to('admin').emit('new_notification', {
      title: 'Đơn hàng bị hủy ⚠️',
      message: `Đơn hàng ${order.orderId} đã bị khách hàng hủy.`,
      type: 'order_cancel'
    });
    await Notification.create({ title: 'Đơn hàng bị hủy ⚠️', message: `Đơn hàng ${order.orderId} đã bị khách hàng hủy.`, type: 'order_cancel', meta: { orderId: order.orderId } });
    await Notification.create({ userId: order.userId, title: 'Đơn hàng bị hủy ⚠️', message: `Đơn hàng ${order.orderId} của bạn đã bị hủy.`, type: 'order_cancel', meta: { orderId: order.orderId } });
    res.json({ success: true, message: "Bạn đã hủy đơn hàng thành công!", order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi khách hàng hủy đơn" });
  }
});

// Khách hàng xác nhận đã nhận được hàng (Chỉ được bấm khi trạng thái là "Đang giao")
app.patch('/api/customer/orders/:id/receive', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng!" });

    if (order.status !== 'Đang giao') {
      return res.status(400).json({ success: false, message: "Đơn hàng chưa được giao, không thể xác nhận!" });
    }

    order.status = 'Đã nhận';
    order.paymentStatus = 'Đã thanh toán'; // Nếu đi COD thì khi nhận hàng coi như đã thanh toán
    await order.save();

    io.to('admin').emit('new_notification', {
      title: 'Khách hàng đã nhận hàng ✅',
      message: `Đơn hàng ${order.orderId} đã được khách hàng xác nhận đã nhận.`,
      type: 'order_received'
    });
    await Notification.create({ title: 'Khách hàng đã nhận hàng ✅', message: `Đơn hàng ${order.orderId} đã được khách hàng xác nhận đã nhận.`, type: 'order_received', meta: { orderId: order.orderId } });
    await Notification.create({ userId: order.userId, title: 'Xác nhận nhận hàng thành công ✅', message: `Bạn đã xác nhận nhận hàng cho đơn ${order.orderId}.`, type: 'order_received', meta: { orderId: order.orderId } });

    res.json({ success: true, message: "Xác nhận đã nhận hàng thành công. Cảm ơn bạn!", order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi xác nhận nhận hàng" });
  }
});

// =========================================================================
// SỬA API ADMIN CẬP NHẬT TRẠNG THÁI (Quyền hủy đè tối cao)
// =========================================================================
app.put('/api/admin/orders/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    // Nếu trạng thái mới yêu cầu là Hủy Đơn Hàng -> Admin được quyền hủy đè mọi trạng thái (trừ Đã nhận)
    if (status === 'Hủy đơn hàng' && order.status !== 'Hủy đơn hàng') {
      if (order.status === 'Đã nhận') {
        return res.status(400).json({ success: false, message: "Đơn hàng đã hoàn thành, không thể hủy đè!" });
      }
      // Hoàn lại số lượng tồn kho sản phẩm khi admin hủy
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      order.status = 'Hủy đơn hàng';
      order.paymentStatus = 'FAILED';
    } else {
      // Các trạng thái tiến trình thông thường do Admin chỉ định (Đang đóng gói, Đang giao)
      order.status = status;
      if (paymentStatus) order.paymentStatus = paymentStatus;
    }
    await order.save();
    // Gửi đích danh tới room của UserId chủ đơn hàng đó
    io.to(order.userId.toString()).emit('new_notification', {
      title: 'Cập nhật đơn hàng 📦',
      message: `Đơn hàng ${order.orderId} của bạn đã chuyển sang trạng thái: ${status}.`,
      type: 'order_status'
    });
    await Notification.create({ userId: order.userId, title: 'Cập nhật đơn hàng 📦', message: `Đơn hàng ${order.orderId} của bạn đã chuyển sang trạng thái: ${status}.`, type: 'order_status', meta: { orderId: order.orderId, status } });
    res.json({ success: true, message: "Cập nhật trạng thái đơn thành công!", order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể cập nhật đơn hàng" });
  }
});

// [ADMIN] Lấy danh sách toàn bộ đơn hàng
app.get('/api/admin/orders', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Không thể tải danh sách đơn hàng" });
  }
});

// [ADMIN] Cập nhật trạng thái đơn thủ công
app.put('/api/admin/orders/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status, paymentStatus }, { new: true });
    res.json({ success: true, message: "Cập nhật trạng thái đơn thành công!", order: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể cập nhật đơn hàng" });
  }
});

// [ADMIN] Xuất Excel danh sách hóa đơn đơn hàng
app.get('/api/admin/orders/export-excel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách Đơn hàng TechShop');

    worksheet.columns = [
      { header: 'Mã Đơn Hàng', key: 'orderId', width: 15 },
      { header: 'Tên Khách Hàng', key: 'customerName', width: 25 },
      { header: 'Số Điện Thoại', key: 'phoneNumber', width: 15 },
      { header: 'Địa Chỉ Giao Hàng', key: 'shippingAddress', width: 35 },
      { header: 'Phương Thức', key: 'paymentMethod', width: 15 },
      { header: 'Thanh Toán', key: 'paymentStatus', width: 15 },
      { header: 'Trạng Thái Đơn', key: 'status', width: 15 },
      { header: 'Tổng Tiền (VNĐ)', key: 'totalPrice', width: 20 },
      { header: 'Ngày Tạo', key: 'createdAt', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E88E5' } };

    orders.forEach((order) => {
    worksheet.addRow({
      orderId: order.orderId, 
      customerName: order.customerName, 
      phoneNumber: order.phoneNumber, 
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod === 'COD' ? 'Nhận hàng (COD)' : 'Chuyển khoản',
      paymentStatus: order.paymentStatus === 'PAID' ? 'Đã thanh toán' : (order.paymentStatus === 'FAILED' ? 'Thất bại' : 'Chờ xử lý'),
      // Đồng bộ trạng thái Tiếng Việt chuẩn tại đây:
      status: order.status, 
      totalPrice: order.totalPrice, 
      createdAt: new Date(order.createdAt).toLocaleString('vi-VN'),
    });
  });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + `Bao_Cao_Don_Hang_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Không thể tạo file báo cáo Excel" });
  }
});

// [ADMIN] Số liệu Dashboard Thống kê nâng cấp (Bao gồm cả Top Khách hàng & Top Sản phẩm)
app.get('/api/admin/dashboard-stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    // Đơn hàng hợp lệ tạo ra doanh thu thực tế (Đã trả tiền hoặc COD đã giao thành công)
    const validOrders = await Order.find({
      $or: [
        { paymentStatus: 'Đã thanh toán' },
        { status: 'Đã nhận' }
      ]
    });

    // 1. Tính tổng doanh thu
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    
    // 2. Đếm số đơn chờ xử lý (Chờ thanh toán/Xác nhận và chưa bị hủy)
    const pendingOrders = await Order.countDocuments({ 
      paymentStatus: 'Chờ thanh toán',
      status: { $ne: 'Hủy đơn hàng' }
    });

    // 3. Phân tích Top 5 người mua nhiều nhất (Dựa trên tổng số tiền họ đã chi trả)
    const customerMap = {};
    validOrders.forEach(order => {
      // Nhóm theo tên + sđt để tránh trùng lặp nếu khách mua không đăng nhập hoặc đổi tài khoản
      const key = `${order.customerName} (${order.phoneNumber})`; 
      if (!customerMap[key]) {
        customerMap[key] = { name: order.customerName, phone: order.phoneNumber, totalSpent: 0, orderCount: 0 };
      }
      customerMap[key].totalSpent += order.totalPrice || 0;
      customerMap[key].orderCount += 1;
    });

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // 4. Phân tích Top 5 sản phẩm bán chạy nhất (Dựa trên tổng số lượng quantity đã bán)
    const productMap = {};
    validOrders.forEach(order => {
      order.items.forEach(item => {
        const pId = item.productId.toString();
        if (!productMap[pId]) {
          productMap[pId] = { name: item.name, totalQty: 0, totalRevenue: 0 };
        }
        productMap[pId].totalQty += item.quantity || 0;
        productMap[pId].totalRevenue += (item.price * item.quantity) || 0;
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);

    // Trả về toàn bộ dữ liệu thống kê tích hợp cho frontend
    res.json({ 
      totalProducts, 
      totalOrders, 
      totalRevenue, 
      pendingOrders,
      topCustomers,
      topProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải số liệu thống kê Dashboard' });
  }
});
// [ADMIN] Dữ liệu biểu đồ doanh thu theo tháng (Đã đồng bộ đơn Đã Nhận & Ship COD)
app.get('/api/admin/reports-chart', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    
    // 🌟 SỬA ĐIỀU KIỆN: Bắt cả đơn chuyển khoản thành công HOẶC đơn COD đã giao (Đã nhận)
    const paidOrders = await Order.find({ 
      createdAt: { $gte: startOfYear },
      $or: [
        { paymentStatus: 'Đã thanh toán' },
        { status: 'Đã nhận' }
      ]
    });

    // Tính tổng doanh thu tích lũy để trả về cho Frontend làm Summary Card
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const totalOrdersCount = paidOrders.length;

    const months = Array.from({ length: 12 }, (_, i) => ({ 
      name: `Tháng ${i + 1}`, 
      DoanhThu: 0, 
      DonHang: 0 
    }));

    paidOrders.forEach(o => {
      const m = new Date(o.createdAt).getMonth();
      months[m].DoanhThu += o.totalPrice || 0;
      months[m].DonHang += 1;
    });

    // Trả về cả mảng tháng và các biến tổng hợp
    res.json({
      months,
      totalRevenue,
      totalOrdersCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải dữ liệu báo cáo' });
  }
});
// [ADMIN] Xuất báo cáo doanh thu Excel (Đã đồng bộ đơn Đã Nhận & Ship COD)
app.get('/api/admin/export-reports', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // 🌟 SỬA ĐIỀU KIỆN: Xuất đầy đủ các đơn tạo ra dòng tiền thực tế
    const orders = await Order.find({
      $or: [
        { paymentStatus: 'Đã thanh toán' },
        { status: 'Đã nhận' }
      ]
    }).sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo Doanh thu TechShop');

    worksheet.columns = [
      { header: 'Mã Đơn Hàng', key: 'orderId', width: 15 },
      { header: 'Tên Khách Hàng', key: 'customerName', width: 25 },
      { header: 'Số Điện Thoại', key: 'phoneNumber', width: 15 },
      { header: 'Phương Thức', key: 'paymentMethod', width: 15 },
      { header: 'Tổng Tiền (VNĐ)', key: 'totalPrice', width: 20 },
      { header: 'Trạng Thái Đơn', key: 'status', width: 15 },
      { header: 'Thanh Toán', key: 'paymentStatus', width: 18 },
      { header: 'Ngày Tạo', key: 'createdAt', width: 20 },
    ];
    worksheet.getRow(1).font = { bold: true };

    orders.forEach(order => {
      worksheet.addRow({
        orderId: order.orderId, 
        customerName: order.customerName, 
        phoneNumber: order.phoneNumber,
        paymentMethod: order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'COD',
        totalPrice: order.totalPrice, 
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: new Date(order.createdAt).toLocaleString('vi-VN')
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + `Bao_Cao_Doanh_Thu_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo file báo cáo Excel' });
  }
});

// ==========================================
//        BỔ SUNG: API ADMIN QUẢN LÝ USER
// ==========================================

// 1. API ĐỘC LẬP: Lấy danh sách cấu hình trạng thái tài khoản người dùng
app.get('/api/admin/customers/statuses', authMiddleware, adminMiddleware, (req, res) => {
  try {
    // Trả về mảng trạng thái có cấu trúc rõ ràng để map vào Select
    const accountStatuses = [
      { label: 'Đang hoạt động', value: 'true' },
      { label: 'Đã khóa', value: 'false' }
    ];
    res.json({ success: true, data: accountStatuses });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể lấy danh sách trạng thái tài khoản" });
  }
});

// 2. API DANH SÁCH USER: Cập nhật nhận query tìm kiếm động nâng cao
app.get('/api/admin/customers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search, status, date } = req.query;
    let query = { role: 'customer' };

    // Lọc theo trạng thái tài khoản (Đổi chuỗi text nhận từ query sang giá trị Boolean chuẩn)
    if (status) {
      query.isActive = status === 'true';
    }

    // Lọc Ngày đăng ký thông minh: Quét trọn gói từ đầu ngày đến cuối ngày
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    // Freetext: Tìm kiếm song song đồng thời theo Tên HOẶC Email không phân biệt hoa thường
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Tiến hành truy vấn database và sắp xếp tài khoản mới đăng ký lên đầu
    const users = await User.find(query).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tải dữ liệu người dùng' });
  }
});
// [CUSTOMER] Lấy danh sách đơn hàng cá nhân
app.get('/api/customer/orders', authMiddleware, async (req, res) => {
  try {
    // Lọc các đơn hàng có userId trùng với ID người dùng hiện tại
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Không thể tải danh sách đơn hàng cá nhân" });
  }
});

// ==========================================
//             8. NOTIFICATIONS API
// ==========================================

app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const query = req.user.role === 'admin'
      ? { $or: [{ userId: null }, { userId: { $exists: false } }] }
      : { userId: req.user.id };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean(),
      Notification.countDocuments({ ...query, isRead: false })
    ]);

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải thông báo' });
  }
});

app.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id, $or: [{ userId: null }, { userId: { $exists: false } }] }
      : { _id: req.params.id, userId: req.user.id };

    const notification = await Notification.findOneAndUpdate(query, { isRead: true }, { new: true });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
});

app.patch('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { $or: [{ userId: null }, { userId: { $exists: false } }] }
      : { userId: req.user.id };

    await Notification.updateMany(query, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể đánh dấu đã đọc' });
  }
});

// ==========================================
//             8. INTEGRATED AI CHATBOT (PUBLIC)
// ==========================================

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const products = await Product.find({}, 'name price stock description category brand');
    
    let productContext = "Dưới đây là danh sách toàn bộ sản phẩm công nghệ đang có sẵn trong cửa hàng TechShop của chúng ta:\n";
    products.forEach((p, index) => {
      productContext += `${index + 1}. Tên: ${p.name} | Giá: ${p.price.toLocaleString()} VNĐ | Hãng: ${p.brand} | Loại: ${p.category} | Số lượng tồn kho: ${p.stock} chiếc | Mô tả: ${p.description || 'Không có'}\n`;
    });

    const systemPrompt = `Bạn là một nhân viên tư vấn bán hàng trực tuyến xuất sắc, thân thiện và am hiểu công nghệ tại cửa hàng "TechShop".
Nhiệm vụ trọng tâm của bạn là sử dụng ngữ cảnh danh sách sản phẩm được cung cấp bên dưới để trả lời các câu hỏi từ khách hàng một cách ngắn gọn, thuyết phục, tập trung chốt đơn.

Quy tắc bắt buộc khi tư vấn:
1. LUÔN LUÔN trả lời bằng Tiếng Việt lịch sự, xưng hô là "TechShop" hoặc "Shop" và gọi khách hàng là "bạn" hoặc "quý khách".
2. Chỉ tư vấn và báo giá các sản phẩm thực tế ĐANG CÓ TRONG KHO theo đúng danh sách bên dưới cung cấp.
3. Nếu khách hàng hỏi mua sản phẩm có số lượng tồn kho bằng 0, hãy báo là sản phẩm này hiện tại đang tạm hết hàng và gợi ý khách sang một dòng máy khác cùng phân khúc đang còn hàng.
4. Tuyệt đối KHÔNG ĐƯỢC tự ý bịa đặt thông tin cấu hình hoặc tự tăng/giảm giá tiền sai lệch so với danh sách sản phẩm dưới đây.

--- NGỮ CẢNH DỮ LIỆU CỬA HÀNG ---
${productContext}
---------------------------------

Khách hàng nhắn: "${message}"
Hãy đưa ra câu trả lời tư vấn ngắn gọn, chuyên nghiệp và tối ưu nhất:`;

    const aiResponse = await axios.post(OLLAMA_API, {
      model: 'gemma:2b', 
      prompt: systemPrompt,
      stream: false
    });

    res.json({ content: aiResponse.data.response });

  } catch (error) {
    console.error("Lỗi AI:", error.message);
    res.status(500).json({ content: "Chatbot đang bảo trì, vui lòng quay lại sau!" });
  }
});

// ==========================================
//             9. AUTOMATED CRON JOB
// ==========================================
cron.schedule('*/5 * * * *', async () => {
 try {
    // Tìm các đơn hàng chưa thanh toán, phương thức là chuyển khoản và đã quá 5 phút
    const expirationTime = new Date(Date.now() - 5 * 60 * 1000); 
    const expiredOrders = await Order.find({ 
      paymentStatus: 'Chờ thanh toán', 
      paymentMethod: 'BANK_TRANSFER',
      status: 'Chờ xác nhận',
      createdAt: { $lt: expirationTime } 
    });

    for (const order of expiredOrders) {
      // Hoàn kho trước khi hủy đơn tự động
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      order.paymentStatus = 'Thanh toán thất bại'; 
      order.status = 'Hủy đơn hàng';
      await order.save();
      io.to('admin').emit('new_notification', {
        title: 'Đơn hàng treo đã bị hủy ⏰',
        message: `Đơn hàng ${order.orderId} đã tự động hủy do quá 5 phút chưa thanh toán.`,
        type: 'order_auto_cancel'
      });
      io.to(order.userId.toString()).emit('new_notification', {
        title: 'Đơn hàng đã bị hủy ⏰',
        message: `Đơn hàng ${order.orderId} của bạn đã tự động hủy do quá 5 phút chưa thanh toán.`,
        type: 'order_auto_cancel'
      });
      await Notification.create({ title: 'Đơn hàng treo đã bị hủy ⏰', message: `Đơn hàng ${order.orderId} đã tự động hủy do quá 5 phút chưa thanh toán.`, type: 'order_auto_cancel', meta: { orderId: order.orderId } });
      await Notification.create({ userId: order.userId, title: 'Đơn hàng đã bị hủy ⏰', message: `Đơn hàng ${order.orderId} của bạn đã tự động hủy do quá 5 phút chưa thanh toán.`, type: 'order_auto_cancel', meta: { orderId: order.orderId } });
      console.log(`[Hệ thống] Đã tự động hủy đơn treo quá 5 phút: ${order.orderId}`);
    }
  } catch (error) {
    console.error('Lỗi khi quét và hủy đơn hàng treo:', error);
  }
});

// Dọn thông báo cũ hơn 7 ngày để giữ database nhẹ
cron.schedule('0 3 * * *', async () => {
  try {
    const expiredAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({ createdAt: { $lt: expiredAt } });
    if (result.deletedCount > 0) {
      console.log(`[Hệ thống] Đã xóa ${result.deletedCount} thông báo cũ hơn 7 ngày`);
    }
  } catch (error) {
    console.error('Lỗi khi dọn thông báo cũ:', error);
  }
});

// Khởi chạy máy chủ
httpServer.listen(PORT, () => {
  console.log(`🚀 Server TechShop Backend đang chạy mượt mà tại: http://localhost:${PORT}`);
});