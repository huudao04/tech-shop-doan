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

// Schema Đánh giá & Phản hồi
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true }, 
  rating: { type: Number, required: true, min: 1, max: 5 }, 
  comment: { type: String, required: true }, 
  reply: { type: String, default: "" }, 
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
  paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER'], required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], default: 'PENDING' },
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

// ==========================================
//             5. API PRODUCTS (PUBLIC & ADMIN)
// ==========================================

// Lấy danh sách sản phẩm (Public)
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, brand } = req.query;
    let query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (category) query.category = category;
    if (brand) query.brand = brand;

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống khi tải sản phẩm" });
  }
});

// Lấy danh mục động (Public)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.filter(Boolean).sort().map(name => ({ name })));
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải danh mục' });
  }
});

// Lấy thương hiệu động (Public)
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    res.json(brands.filter(Boolean).sort().map(name => ({ name })));
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
    const { name, price, description, category, brand, stock } = req.body;
    let fileNames = req.files ? req.files.map(file => file.filename) : [];

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
    const { name, price, description, category, brand, stock } = req.body;
    let updateData = { name, price: Number(price), description, category, brand, stock: Number(stock) };
    if (req.files && req.files.length > 0) updateData.image = req.files.map(file => file.filename);

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
    res.json({ success: true, message: "Xóa sản phẩm thành công!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể xóa sản phẩm" });
  }
});

// ==========================================
//             6. API REVIEWS
// ==========================================

// Gửi đánh giá (Public)
app.post('/api/products/:productId/reviews', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(req.params.productId), name, rating: Number(rating), comment
    });
    await newReview.save();
    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể gửi đánh giá" });
  }
});

// [ADMIN] Lấy toàn bộ đánh giá
app.get('/api/admin/reviews', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find().populate('productId', 'name image').sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống không thể tải dữ liệu đánh giá" });
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
app.post('/api/orders',authMiddleware, async (req, res) => {
  try {
    const { customerName, phoneNumber, shippingAddress, paymentMethod, items, totalPrice } = req.body;
    const userId = req.user.id;

    for (const item of items) {
      const product = await Product.findById(item.productId); 
      if (!product || product.stock < item.quantity) return res.status(400).json({ success: false, message: `Sản phẩm không đủ hàng!` });
    }

    const orderId = 'DH' + Math.floor(100000 + Math.random() * 900000);
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
    }

    const newOrder = new Order({
      orderId, userId, customerName, phoneNumber, shippingAddress, paymentMethod,
      items: items.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      totalPrice
    });

    let paymentGateway = null;
    if (paymentMethod === 'BANK_TRANSFER') {
      const frontendOrigin = req.get('origin') || 'http://localhost:5173';
      const checkoutFields = sepayClient.checkout.initOneTimePaymentFields({
        operation: 'PURCHASE', payment_method: 'BANK_TRANSFER', order_invoice_number: orderId,
        order_amount: Number(totalPrice), currency: 'VND', order_description: `Thanh toan don hang ${orderId}`,
        success_url: `${frontendOrigin}/cart?status=success&orderId=${orderId}`,
        cancel_url: `${frontendOrigin}/cart?status=cancel&orderId=${orderId}`
      });
      const checkoutUrl = sepayClient.checkout.initCheckoutUrl();
      newOrder.paymentUrl = checkoutUrl;
      paymentGateway = { checkoutUrl, fields: checkoutFields };
    }

    await newOrder.save();
    return res.status(201).json({ success: true, order: newOrder, paymentGateway });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý đơn hàng!" });
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
      order.paymentStatus = 'PAID';
      order.status = 'CONFIRMED'; 
      await order.save();
    }
    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xử lý webhook" });
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
        orderId: order.orderId, customerName: order.customerName, phoneNumber: order.phoneNumber, shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod === 'COD' ? 'Nhận hàng (COD)' : 'Chuyển khoản',
        paymentStatus: order.paymentStatus === 'PAID' ? 'Đã thanh toán' : (order.paymentStatus === 'FAILED' ? 'Thất bại' : 'Chờ xử lý'),
        status: order.status === 'PENDING' ? 'Chờ duyệt' : (order.status === 'CONFIRMED' ? 'Đã xác nhận' : (order.status === 'SHIPPED' ? 'Đang giao' : (order.status === 'DELIVERED' ? 'Đã giao' : 'Đã hủy'))),
        totalPrice: order.totalPrice, createdAt: new Date(order.createdAt).toLocaleString('vi-VN'),
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

// [ADMIN] Số liệu Dashboard Thống kê
app.get('/api/admin/dashboard-stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.find({ paymentStatus: 'PAID' });
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const pendingOrders = await Order.countDocuments({ paymentStatus: 'PENDING' });

    res.json({ totalProducts, totalOrders, totalRevenue, pendingOrders });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải số liệu thống kê Dashboard' });
  }
});

// [ADMIN] Dữ liệu biểu đồ doanh thu theo tháng
app.get('/api/admin/reports-chart', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const paidOrders = await Order.find({ paymentStatus: 'PAID', createdAt: { $gte: startOfYear } });
    const months = Array.from({ length: 12 }, (_, i) => ({ name: `Tháng ${i + 1}`, DoanhThu: 0, DonHang: 0 }));

    paidOrders.forEach(o => {
      const m = new Date(o.createdAt).getMonth();
      months[m].DoanhThu += o.totalPrice || 0;
      months[m].DonHang += 1;
    });
    res.json(months);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải dữ liệu báo cáo' });
  }
});

// [ADMIN] Xuất báo cáo doanh thu Excel riêng biệt
app.get('/api/admin/export-reports', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ paymentStatus: 'PAID' }).sort({ createdAt: -1 });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo Doanh thu TechShop');

    worksheet.columns = [
      { header: 'Mã Đơn Hàng', key: 'orderId', width: 15 },
      { header: 'Tên Khách Hàng', key: 'customerName', width: 25 },
      { header: 'Số Điện Thoại', key: 'phoneNumber', width: 15 },
      { header: 'Phương Thức', key: 'paymentMethod', width: 15 },
      { header: 'Tổng Tiền (VNĐ)', key: 'totalPrice', width: 20 },
      { header: 'Ngày Tạo', key: 'createdAt', width: 20 },
    ];
    worksheet.getRow(1).font = { bold: true };

    orders.forEach(order => {
      worksheet.addRow({
        orderId: order.orderId, customerName: order.customerName, phoneNumber: order.phoneNumber,
        paymentMethod: order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'COD',
        totalPrice: order.totalPrice, createdAt: new Date(order.createdAt).toLocaleString('vi-VN')
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
//             8. INTEGRATED AI CHATBOT (PUBLIC)
// ==========================================

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const products = await Product.find({}, 'name price stock description category brand');
    let productContext = "Danh sách sản phẩm cửa hàng TechShop:\n";
    products.forEach((p, index) => {
      productContext += `${index + 1}. Tên: ${p.name} | Giá: ${p.price.toLocaleString()} VNĐ | Hãng: ${p.brand} | Tồn kho: ${p.stock}\n`;
    });

    const systemPrompt = `Bạn là nhân viên tư vấn bán hàng tại "TechShop". Sử dụng dữ liệu dưới để trả lời thân thiện, tập trung chốt đơn.\n\n${productContext}\nKhách: "${message}"`;
    const aiResponse = await axios.post(OLLAMA_API, { model: 'gemma:2b', prompt: systemPrompt, stream: false });
    res.json({ content: aiResponse.data.response });
  } catch (error) {
    res.status(500).json({ content: "Chatbot đang bảo trì, vui lòng quay lại sau!" });
  }
});

// ==========================================
//             9. AUTOMATED CRON JOB
// ==========================================
cron.schedule('*/5 * * * *', async () => {
  try {
    const expirationTime = new Date(Date.now() - 15 * 60 * 1000); 
    const expiredOrders = await Order.find({ paymentStatus: 'PENDING', createdAt: { $lt: expirationTime } });
    for (const order of expiredOrders) {
      order.paymentStatus = 'FAILED'; 
      order.status = 'CANCELLED';
      await order.save();
    }
  } catch (error) {
    console.error('Lỗi khi quét và hủy đơn hàng treo:', error);
  }
});

// Khởi chạy máy chủ
app.listen(PORT, () => {
  console.log(`🚀 Server TechShop Backend đang chạy mượt mà tại: http://localhost:${PORT}`);
});