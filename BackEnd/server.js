import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mongoose from 'mongoose';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { SePayPgClient } from 'sepay-pg-node'; // Import thư viện SePay

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const OLLAMA_API = 'http://localhost:11434/api/generate'; 

// Khởi tạo client SePay (Thay bằng thông tin thật trên Dashboard SePay của ông)
const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: 'SP-LIVE-NH783B44',   
  secret_key: 'spsk_live_FJhRQ7N56cZqs2CV78jUYt8GsbfSx8Wi'  
});

// 1. Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/tech_shop')
  .then(() => console.log('✅ Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// 2. Định nghĩa Schema cho Sản phẩm
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  category: { type: String },
  brand: { type: String },
  stock: { type: Number, default: 0 },
  image: { type: [String], default: [] }, // Mảng chuỗi để lưu nhiều ảnh
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Schema Đánh giá & Phản hồi sản phẩm
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true }, 
  rating: { type: Number, required: true, min: 1, max: 5 }, 
  comment: { type: String, required: true }, 
  reply: { type: String, default: "" }, 
  createdAt: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);

// Schema Đơn hàng (Orders)
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // Mã đơn hàng dạng TS_xxxxxx
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
  qrCodeUrl: { type: String }, // Lưu link ảnh QR chuyển khoản ngân hàng nếu thanh toán bằng BANK_TRANSFER
  paymentUrl: { type: String }, // Lưu link checkout SePay nếu thanh toán bằng BANK_TRANSFER
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

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

// ==========================================
//             ĐOẠN ROUTE API PRODUCTS
// ==========================================

// 1. API Lấy toàn bộ DANH SÁCH sản phẩm (Có bộ lọc tìm kiếm và phân loại)
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, brand } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }
    if (brand) {
      query.brand = brand;
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("Lỗi lấy danh sách sản phẩm:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi tải sản phẩm" });
  }
});

// API lấy danh mục động cho Admin từ dữ liệu sản phẩm hiện có
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(
      categories
        .filter(Boolean)
        .sort()
        .map((name) => ({ name }))
    );
  } catch (error) {
    console.error('Lỗi lấy danh mục:', error);
    res.status(500).json({ message: 'Không thể tải danh mục' });
  }
});

// API lấy thương hiệu động cho Admin từ dữ liệu sản phẩm hiện có
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    res.json(
      brands
        .filter(Boolean)
        .sort()
        .map((name) => ({ name }))
    );
  } catch (error) {
    console.error('Lỗi lấy thương hiệu:', error);
    res.status(500).json({ message: 'Không thể tải thương hiệu' });
  }
});

// 2. API Admin THÊM sản phẩm mới kèm upload tối đa 5 ảnh
app.post('/api/products', upload.array('image', 5), async (req, res) => {
  try {
    const { name, price, description, category, brand, stock } = req.body;
    
    let fileNames = [];
    if (req.files && req.files.length > 0) {
      fileNames = req.files.map(file => file.filename);
    }

    const newProduct = new Product({
      name,
      price: Number(price),
      description,
      category,
      brand,
      stock: Number(stock),
      image: fileNames
    });

    await newProduct.save();
    res.status(201).json({ success: true, message: "Thêm sản phẩm thành công!", product: newProduct });
  } catch (error) {
    console.error("Lỗi thêm sản phẩm:", error);
    res.status(500).json({ success: false, message: "Không thể thêm sản phẩm" });
  }
});

// 3. API Admin CẬP NHẬT sản phẩm hiện tại
app.put('/api/products/:id', upload.array('image', 5), async (req, res) => {
  try {
    const { name, price, description, category, brand, stock } = req.body;
    let updateData = {
      name,
      price: Number(price),
      description,
      category,
      brand,
      stock: Number(stock)
    };

    if (req.files && req.files.length > 0) {
      updateData.image = req.files.map(file => file.filename);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedProduct) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });

    res.json({ success: true, message: "Cập nhật thành công!", product: updatedProduct });
  } catch (error) {
    console.error("Lỗi cập nhật sản phẩm:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật sản phẩm" });
  }
});

// 4. API Admin XÓA sản phẩm khỏi DB
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    res.json({ success: true, message: "Xóa sản phẩm thành công!" });
  } catch (error) {
    console.error("Lỗi xóa sản phẩm:", error);
    res.status(500).json({ success: false, message: "Không thể xóa sản phẩm" });
  }
});

// 5. API Lấy CHI TIẾT 1 sản phẩm kèm theo danh sách Đánh giá & Phản hồi (Cho người dùng)
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    
    // Đồng bộ tìm kiếm bằng ObjectId chuẩn hóa
    const reviews = await Review.find({ productId: new mongoose.Types.ObjectId(req.params.id) }).sort({ createdAt: -1 });
    
    res.json({ product, reviews });
  } catch (error) {
    console.error("Lỗi lấy chi tiết sản phẩm:", error);
    res.status(500).json({ message: "ID sản phẩm không hợp lệ hoặc lỗi hệ thống" });
  }
});

// ==========================================
//             ĐOẠN ROUTE API REVIEWS
// ==========================================

// 1. API Người dùng gửi đánh giá mới lên hệ thống
app.post('/api/products/:productId/reviews', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(req.params.productId), // Nhận diện chuẩn xác ID từ URL params
      name,
      rating: Number(rating),
      comment
    });

    await newReview.save();
    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    console.error("Lỗi khi lưu đánh giá:", error);
    res.status(500).json({ success: false, message: "Không thể gửi đánh giá" });
  }
});

// 2. API Admin lấy toàn bộ danh sách đánh giá từ hệ thống
app.get('/api/admin/reviews', async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('productId', 'name image') 
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error("Lỗi lấy danh sách đánh giá của Admin:", error);
    res.status(500).json({ message: "Lỗi hệ thống không thể tải dữ liệu đánh giá" });
  }
});

// 3. API Admin THÊM đánh giá mới (Fake Review chủ động)
app.post('/api/admin/reviews', async (req, res) => {
  try {
    const { productId, name, rating, comment, reply } = req.body;
    
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(productId), // Ép kiểu string sang ObjectId của MongoDB
      name,
      rating: Number(rating),
      comment,
      reply: reply || ""
    });

    await newReview.save();
    
    const populatedReview = await Review.findById(newReview._id).populate('productId', 'name image');
    res.status(201).json({ success: true, message: "Thêm đánh giá fake thành công!", review: populatedReview });
  } catch (error) {
    console.error("Lỗi thêm đánh giá:", error);
    res.status(500).json({ success: false, message: "Không thể thêm đánh giá" });
  }
});

// 4. API Admin SỬA thông tin nội dung đánh giá có sẵn
app.put('/api/admin/reviews/:id', async (req, res) => {
  try {
    const { productId, name, rating, comment } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { productId: new mongoose.Types.ObjectId(productId), name, rating: Number(rating), comment },
      { new: true }
    ).populate('productId', 'name image');

    if (!updatedReview) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá cần sửa" });
    }
    res.json({ success: true, message: "Cập nhật đánh giá thành công!", review: updatedReview });
  } catch (error) {
    console.error("Lỗi cập nhật đánh giá:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật" });
  }
});

// 5. API Admin PHẢN HỒI (Reply) bình luận của người dùng
app.patch('/api/admin/reviews/:id/reply', async (req, res) => {
  try {
    const { reply } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { reply: reply },
      { new: true }
    ).populate('productId', 'name image');

    if (!updatedReview) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá để phản hồi" });
    }
    res.json({ success: true, message: "Gửi phản hồi thành công!", review: updatedReview });
  } catch (error) {
    console.error("Lỗi phản hồi đánh giá:", error);
    res.status(500).json({ success: false, message: "Không thể gửi phản hồi" });
  }
});

// 6. API Admin XÓA đánh giá khỏi hệ thống
app.delete('/api/admin/reviews/:id', async (req, res) => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    if (!deletedReview) return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi cần xóa" });
    res.json({ success: true, message: "Xóa đánh giá thành công!" });
  } catch (error) {
    console.error("Lỗi xóa phản hồi:", error);
    res.status(500).json({ success: false, message: "Không thể thực hiện hành động xóa" });
  }
});

// ==========================================
//             ĐOẠN ROUTE API ORDERS
// ==========================================

// 1. API Người dùng TẠO ĐƠN HÀNG MỚI (COD hoặc Chuyển khoản ngân hàng qua cổng SePay QR)
app.post('/api/orders', async (req, res) => {
  try {
    // 1. Kiểm tra kĩ req.body truyền sang
    const { customerName, phoneNumber, shippingAddress, paymentMethod, items, totalPrice } = req.body;

    // Log kiểm tra nếu thấy trống thông tin khách hàng ở Terminal
    console.log("Dữ liệu khách hàng nhận được ở BE:", { customerName, phoneNumber, shippingAddress });

    // 2. Vòng lặp kiểm tra kho sản phẩm (Đoạn này của ông đã chạy đúng)
    for (const item of items) {
      if (!item.productId || item.productId === "undefined") {
        return res.status(400).json({ success: false, message: "Lỗi dữ liệu: ID sản phẩm không hợp lệ!" });
      }
      const product = await Product.findById(item.productId); 
      if (!product) {
        return res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm!` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Sản phẩm ${product.name} không đủ số lượng!` });
      }
    }

    // 3. Sinh mã đơn hàng ngẫu nhiên 
    const orderId = 'DH' + Math.floor(100000 + Math.random() * 900000);

    // 4. Trừ kho sản phẩm trong Database
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
    }

    const newOrder = new Order({
      orderId,
      customerName: customerName || "Khách mua hàng", // Tránh lỗi required trống
      phoneNumber: phoneNumber || "0000000000",
      shippingAddress: shippingAddress || "Chưa cung cấp địa chỉ",
      paymentMethod,
      items: items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      })),
      totalPrice,
      paymentStatus: 'PENDING',
      status: 'PENDING'
    });

    let paymentGateway = null;

    // 6. Nếu chọn chuyển khoản thì tạo checkout thật của SePay
    if (paymentMethod === 'BANK_TRANSFER') {
      const frontendOrigin = req.get('origin') || 'http://localhost:5173';
      const successUrl = `${frontendOrigin}/cart?status=success&orderId=${orderId}`;
      const cancelUrl = `${frontendOrigin}/cart?status=cancel&orderId=${orderId}`;

      const checkoutFields = sepayClient.checkout.initOneTimePaymentFields({
        operation: 'PURCHASE',
        payment_method: 'BANK_TRANSFER',
        order_invoice_number: orderId,
        order_amount: Number(totalPrice),
        currency: 'VND',
        order_description: `Thanh toan don hang ${orderId}`,
        success_url: successUrl,
        cancel_url: cancelUrl
      });

      const checkoutUrl = sepayClient.checkout.initCheckoutUrl();
      newOrder.paymentUrl = checkoutUrl;
      paymentGateway = {
        checkoutUrl,
        fields: checkoutFields
      };
    }

    // Lưu vào MongoDB collection 'orders'
    await newOrder.save();

    // Trả phản hồi thành công về Frontend
    return res.status(201).json({ success: true, order: newOrder, paymentGateway });

  } catch (error) {
    console.error("Lỗi hệ thống tại Server khi đặt hàng:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi xử lý đơn hàng!" });
  }
});
// 2. API Webhook tiếp nhận tín hiệu thanh toán tự động từ SePay gửi về
app.post('/api/sepay-webhook', async (req, res) => {
  try {
    console.log("📥 [SePay Webhook] Nhận dữ liệu thông báo chuyển khoản tự động:", req.body);
    
    const transaction = sepayClient.verifyWebhookToken(req.body);
    if (!transaction) {
      return res.status(400).json({ message: "Mã bảo mật webhook không hợp lệ" });
    }

    const { code, amount } = transaction; 
    console.log(`🔍 [SePay] Tìm kiếm đơn hàng khớp với nội dung chuyển khoản mã nội dung: ${code}`);

    const order = await Order.findOne({ orderId: code });

    if (!order) {
      console.log(`⚠️ [SePay] Không quét ra mã đơn hàng nào khớp với nội dung chuyển khoản: ${code}`);
      return res.json({ success: false, message: "Nội dung chuyển khoản không khớp với bất kỳ đơn hàng nào." });
    }

    if (order.paymentStatus === 'PAID') {
      console.log(`ℹ️ [SePay] Đơn hàng ${code} này trước đó đã được cập nhật thanh toán thành công.`);
      return res.json({ success: true, message: "Đơn hàng này đã thanh toán xong từ trước." });
    }

    if (amount >= order.totalPrice) {
      order.paymentStatus = 'PAID';
      order.status = 'CONFIRMED'; 
      await order.save();
      console.log(`✅ [SePay] Khớp đơn hàng thành công! Đã tự động kích hoạt ĐÃ THANH TOÁN cho đơn: ${code}`);
      return res.json({ success: true, message: "Kích hoạt và xác nhận đơn hàng tự động thành công!" });
    } else {
      console.log(`❌ [SePay] Số tiền khách chuyển (${amount}) ít hơn tổng tiền cần trả của đơn hàng (${order.totalPrice}).`);
      return res.json({ success: false, message: "Số tiền chuyển khoản chưa đủ hạn mức tổng đơn hàng." });
    }

  } catch (error) {
    console.error("❌ [SePay Webhook Error] Gặp lỗi hệ thống xử lý tự động ngân hàng:", error.message);
    res.status(500).json({ message: "Lỗi xử lý webhook hệ thống" });
  }
});

// 3. API Lấy danh sách toàn bộ Đơn hàng (Dùng cho Admin)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn hàng:", error);
    res.status(500).json({ message: "Không thể tải danh sách đơn hàng" });
  }
});

// 4. API Admin cập nhật Trạng thái đơn hàng và Trạng thái thanh toán theo cách thủ công
app.put('/api/admin/orders/:id', async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status, paymentStatus },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ success: false, message: "Không tồn tại đơn hàng cần cập nhật" });
    res.json({ success: true, message: "Cập nhật trạng thái đơn thành công!", order: updatedOrder });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
    res.status(500).json({ success: false, message: "Không thể cập nhật đơn hàng" });
  }
});

// 5. API Xuất danh sách hóa đơn bán ra định dạng file Excel (Dùng cho Admin)
app.get('/api/admin/orders/export-excel', async (req, res) => {
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
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E88E5' },
    };

    orders.forEach((order) => {
      worksheet.addRow({
        orderId: order.orderId,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod === 'COD' ? 'Nhận hàng (COD)' : 'Chuyển khoản',
        paymentStatus: order.paymentStatus === 'PAID' ? 'Đã thanh toán' : (order.paymentStatus === 'FAILED' ? 'Thất bại' : 'Chờ xử lý'),
        status: order.status === 'PENDING' ? 'Chờ duyệt' : (order.status === 'CONFIRMED' ? 'Đã xác nhận' : (order.status === 'SHIPPED' ? 'Đang giao' : (order.status === 'DELIVERED' ? 'Đã giao' : 'Đã hủy'))),
        totalPrice: order.totalPrice,
        createdAt: new Date(order.createdAt).toLocaleString('vi-VN'),
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + `Bao_Cao_Don_Hang_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Lỗi khi kết xuất file Excel:", error);
    res.status(500).json({ message: "Không thể tạo file báo cáo Excel" });
  }
});

// ==========================================
//             ĐOẠN ROUTE CHATBOT AI
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

// CRON JOB: Tự động chạy quét dọn định kỳ mỗi 5 phút một lần để hủy các đơn hàng treo
cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 [Cron Job] Đang quét các đơn hàng hết hạn thanh toán...');
  try {
    const expirationTime = new Date(Date.now() - 15 * 60 * 1000); 

    const expiredOrders = await Order.find({
      paymentStatus: 'PENDING',
      createdAt: { $lt: expirationTime }
    });

    if (expiredOrders.length > 0) {
      for (const order of expiredOrders) {
        order.paymentStatus = 'FAILED'; 
        order.status = 'CANCELLED';
        await order.save();
        
        console.log(`❌ [Cron Job] Đã tự động chuyển trạng thái FAILED cho đơn hàng: ${order.orderId}`);
      }
    } else {
      console.log('ℹ️ [Cron Job] Không có đơn hàng nào bị hết hạn.');
    }
  } catch (error) {
    console.error('❌ [Cron Job] Lỗi khi quét và hủy đơn hàng treo:', error);
  }
});

// Khởi chạy Máy chủ Node.js Express
app.listen(PORT, () => {
  console.log(`🚀 Server TechShop Backend đang phân phối tại: http://localhost:${PORT}`);
});

// API Admin - Thống kê tổng quan cho Dashboard
app.get('/api/admin/dashboard-stats', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    const paidOrders = await Order.find({ paymentStatus: 'PAID' });
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const pendingOrders = await Order.countDocuments({ paymentStatus: 'PENDING' });

    res.json({ totalProducts, totalOrders, totalRevenue, pendingOrders });
  } catch (error) {
    console.error('Lỗi lấy thống kê dashboard:', error);
    res.status(500).json({ message: 'Không thể tải số liệu thống kê Dashboard' });
  }
});

// API Admin - Dữ liệu cho biểu đồ báo cáo doanh thu (theo tháng trong năm hiện tại)
app.get('/api/admin/reports-chart', async (req, res) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const paidOrders = await Order.find({ paymentStatus: 'PAID', createdAt: { $gte: startOfYear } });

    // Khởi tạo 12 tháng
    const months = Array.from({ length: 12 }, (_, i) => ({ name: `Tháng ${i + 1}`, DoanhThu: 0, DonHang: 0 }));

    paidOrders.forEach(o => {
      const m = new Date(o.createdAt).getMonth();
      months[m].DoanhThu += o.totalPrice || 0;
      months[m].DonHang += 1;
    });

    res.json(months);
  } catch (error) {
    console.error('Lỗi lấy dữ liệu báo cáo chart:', error);
    res.status(500).json({ message: 'Không thể tải dữ liệu báo cáo' });
  }
});

// API Admin - Xuất file báo cáo doanh thu (Excel) — endpoint tương thích với frontend
app.get('/api/admin/export-reports', async (req, res) => {
  try {
    // Lấy các đơn hàng đã thanh toán
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
        orderId: order.orderId,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        paymentMethod: order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'COD',
        totalPrice: order.totalPrice,
        createdAt: new Date(order.createdAt).toLocaleString('vi-VN')
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + `Bao_Cao_Doanh_Thu_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Lỗi xuất báo cáo Excel:', error);
    res.status(500).json({ message: 'Không thể tạo file báo cáo Excel' });
  }
});