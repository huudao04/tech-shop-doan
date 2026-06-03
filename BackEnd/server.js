import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SePayPgClient } from 'sepay-pg-node';
import { randomUUID } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
const pdfParseModule = await import('pdf-parse');
const pdfParse = pdfParseModule?.default || pdfParseModule;

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ;
const PORT = process.env.PORT;

const app = express();
app.use(cors());
app.use(express.json());

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const GEMINI_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

// Khởi tạo client SePay
const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: process.env.SEPAY_MERCHANT_ID,
  secret_key: process.env.SEPAY_SECRET_KEY
});
// CẤU HÌNH TRANSPORTER GỬI EMAIL (Cần lấy Mật khẩu ứng dụng - App Password của Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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
const dbURI = process.env.MONGODB_URI;

if (!dbURI) {
  console.error("LỖI: Biến môi trường MONGODB_URI chưa được thiết lập trên Server!");
  process.exit(1); // Dừng app lại để báo cho bạn biết là chưa cấu hình
}

mongoose.connect(dbURI)
  .then(() => console.log('Đã kết nối cơ sở dữ liệu thành công! 🎉'))
  .catch((err) => {
      console.error('Lỗi kết nối MongoDB:', err);
      process.exit(1); 
  });
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
  createdAt: { type: Date, default: Date.now },
  sold: { type: Number, default: 0 }
},{ timestamps: true });

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
  stockReserved: { type: Boolean, default: false },
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

// Schema Giỏ hàng
const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      image: { type: String, default: '' },
      brand: { type: String, default: '' },
      category: { type: String, default: '' },
      quantity: { type: Number, required: true, min: 1, default: 1 }
    }
  ]
}, { timestamps: true });
const Cart = mongoose.model('Cart', cartSchema);

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: String },
  messages: { type: [chatMessageSchema], default: [] }
}, { timestamps: true });

chatHistorySchema.index({ userId: 1 }, { sparse: true });
chatHistorySchema.index({ sessionId: 1 }, { sparse: true });

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

const knowledgeSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
});

const Knowledge = mongoose.model('Knowledge', knowledgeSchema);
// ==========================================
//             3. CẤU HÌNH MIDDLEWARES
// ==========================================

// Middleware kiểm tra token hợp lệ và trạng thái tài khoản
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Không tìm thấy token, quyền truy cập bị từ chối!' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);

    // Kiểm tra người dùng trong DB để đảm bảo tài khoản còn hoạt động
    const user = await User.findById(verified.id);
    if (!user) return res.status(401).json({ message: 'Tài khoản không tồn tại' });
    if (user.isActive === false) return res.status(401).json({ message: 'Tài khoản đã bị khóa' });

    // Lưu thông tin rút gọn vào req.user
    req.user = { id: user._id.toString(), role: user.role };
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

const normalizeCartItem = (item = {}) => ({
  productId: item.productId || item.id || item._id,
  name: item.name || '',
  price: Number(item.price) || 0,
  image: Array.isArray(item.image) ? (item.image[0] || '') : (item.image || ''),
  brand: item.brand || '',
  category: item.category || '',
  quantity: Math.max(1, Number(item.quantity) || 1)
});

const serializeCartItems = (items = []) => items.map((item) => ({
  id: item.productId?.toString?.() || String(item.productId || ''),
  _id: item.productId?.toString?.() || String(item.productId || ''),
  productId: item.productId?.toString?.() || String(item.productId || ''),
  name: item.name,
  price: item.price,
  image: item.image || '',
  brand: item.brand || '',
  category: item.category || '',
  quantity: item.quantity || 1
}));

const getOptionalUserId = (req) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return null;

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    return verified.id || null;
  } catch (error) {
    return null;
  }
};

const resolveChatIdentity = (req) => {
  const userId = getOptionalUserId(req);
  const sessionId = req.body?.sessionId || req.query?.sessionId || null;

  if (userId) {
    return { userId, sessionId: sessionId || null };
  }

  return { userId: null, sessionId: sessionId || randomUUID() };
};

const buildChatHistoryQuery = ({ userId, sessionId }) => {
  if (userId) return { userId };
  if (sessionId) return { sessionId };
  return null;
};

const EMBEDDING_MODEL_CANDIDATES = Array.from(new Set([
  process.env.EMBEDDING_MODEL,
  'gemini-embedding-2',
  'gemini-embedding-001'
].filter(Boolean)));

const prepareEmbeddingContent = (text, kind = 'query', modelName = EMBEDDING_MODEL_CANDIDATES[0]) => {
  const content = String(text || '').trim();

  if (modelName === 'gemini-embedding-2') {
    if (kind === 'document') {
      return `title: none | text: ${content}`;
    }

    return `task: search result | query: ${content}`;
  }

  return content;
};

const getEmbedding = async (text, kind = 'query') => {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  }

  let lastError = null;

  for (const modelName of EMBEDDING_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const embeddingInput = prepareEmbeddingContent(text, kind, modelName);
      const result = await model.embedContent(embeddingInput);
      return result?.embedding?.values || [];
    } catch (error) {
      lastError = error;
      if (error?.status === 404) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Embedding model not available. Set process.env.EMBEDDING_MODEL to a supported Gemini embedding model. Last error: ${lastError?.message || lastError}`
  );
};

const cosineSimilarity = (vecA = [], vecB = []) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  const length = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index += 1) {
    const valueA = Number(vecA[index]) || 0;
    const valueB = Number(vecB[index]) || 0;

    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (!magnitudeA || !magnitudeB) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

const buildProductImagePath = (image) => {
  if (Array.isArray(image)) {
    const firstImage = image[0] || '';
    if (!firstImage) return '';
    if (firstImage.startsWith('http')) return firstImage;
    if (firstImage.startsWith('/')) return firstImage;
    return `/images/${firstImage}`;
  }

  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/')) return image;
  return `/images/${image}`;
};

const extractOrderCodeFromMessage = (message) => {
  const orderCodeMatch = message.match(/DH\d{6}/i);
  return orderCodeMatch ? orderCodeMatch[0].toUpperCase() : null;
};

// Hỗ trợ khớp từ khóa tiếng Việt có/không dấu (dùng cho chatbot, gợi ý tìm kiếm, ...)
const makeVietnameseRegex = (keyword) => {
  let str = keyword.toLowerCase().trim();
  str = str.replace(/[aàáạảãâầấậẩẫăằắặẳẵ]/g, '[aàáạảãâầấậẩẫăằắặẳẵ]');
  str = str.replace(/[eèéẹẻẽêềếệểễ]/g, '[eèéẹẻẽêềếệểễ]');
  str = str.replace(/[iìíịỉĩ]/g, '[iìíịỉĩ]');
  str = str.replace(/[oòóọỏõôồốộổỗơờớợởỡ]/g, '[oòóọỏõôồốộổỗơờớợởỡ]');
  str = str.replace(/[uùúụủũưừứựửữ]/g, '[uùúụủũưừứựửữ]');
  str = str.replace(/[yỳýỵỷỹ]/g, '[yỳýỵỷỹ]');
  str = str.replace(/[dđ]/g, '[dđ]');
  return new RegExp(str, 'i');
};

const ORDER_QUESTION_KEYWORDS = [
  'đơn hàng',
  'don hang',
  'mã đơn',
  'ma don',
  'tra cứu',
  'truy vấn',
  'kiểm tra',
  'kiem tra',
  'tình trạng đơn',
  'đơn của tôi',
  'đơn',
  'don'
];

const isOrderQuestion = (message) => {
  const text = String(message || '').trim();
  if (!text) return false;
  if (extractOrderCodeFromMessage(text)) return true;
  return ORDER_QUESTION_KEYWORDS.some((keyword) => makeVietnameseRegex(keyword).test(text));
};

const isProductQuestion = (message) => /\b(sản phẩm|san pham|mặt hàng|mat hang|giới thiệu|gioi thieu|xem chi tiết|chi tiết|chi tiet|mẫu|mau|mua|ảnh|anh|hình ảnh|hinh anh|xem ảnh|xem anh|xem hình|xem hinh)\b/i.test(message);

const buildBestProductMatches = async (message) => {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return [];

  const escapedQuery = normalizedMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const productNameRegex = new RegExp(escapedQuery, 'i');

  const exactMatches = await Product.find({ name: { $regex: `^${escapedQuery}$`, $options: 'i' } })
    .select('_id name price stock description category brand image')
    .limit(3)
    .lean();

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const keywordMatches = await Product.find({ name: { $regex: productNameRegex } })
    .select('_id name price stock description category brand image')
    .limit(3)
    .lean();

  return keywordMatches;
};

const findReferencedProductName = ({ currentMessage = '', recentMessages = '', products = [] }) => {
  const combinedText = `${recentMessages}\n${currentMessage}`.toLowerCase();
  let bestMatch = '';
  let bestIndex = -1;

  for (const product of products) {
    const productName = String(product.name || '').trim();
    if (!productName) continue;

    const lowerName = productName.toLowerCase();
    const index = combinedText.lastIndexOf(lowerName);
    if (index >= 0 && index >= bestIndex) {
      bestIndex = index;
      bestMatch = productName;
    }
  }

  return bestMatch;
};

const parseAiJsonResponse = (text) => {
  if (!text || typeof text !== 'string') return null;

  const trimmedText = text.trim();
  const jsonMatch = trimmedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return null;
  }
};

const detectChatIntent = async ({ message, recentMessages, products }) => {
  if (!genAI) {
    return { intent: 'other', query: message, confidence: 0 };
  }

  const referencedProductName = findReferencedProductName({
    currentMessage: message,
    recentMessages,
    products
  });

  const productNames = products
    .slice(0, 25)
    .map((product) => `- ${product.name}`)
    .join('\n');

  const intentPrompt = `Bạn là bộ phân loại ý định cho chatbot bán hàng TechShop.
Phân tích hội thoại và chỉ trả về JSON hợp lệ theo mẫu:
{"intent":"product|order|other","query":"chuỗi tìm kiếm ngắn gọn hoặc rỗng","confidence":0.0}

Quy tắc:
- intent = product nếu người dùng muốn xem, hỏi, so sánh, tìm, mở, hoặc xem ảnh/hình của sản phẩm.
- intent = order nếu người dùng hỏi đơn hàng, vận chuyển, trạng thái đơn, mã đơn.
- Nếu người dùng nói "cái đó", "nó", "sản phẩm này", "cho tôi xem ảnh", "xem hình", hãy suy luận từ ngữ cảnh hội thoại gần nhất.
- Nếu đã xác định được sản phẩm được nhắc gần nhất, hãy dùng đúng tên đó làm query.
- query nên là tên sản phẩm hoặc cụm từ tìm kiếm ngắn gọn nhất có thể, ưu tiên tên sản phẩm nếu xác định được.
- Không được thêm giải thích ngoài JSON.

Danh sách sản phẩm đang có:
${productNames || '- (trống)'}

Sản phẩm được nhắc gần nhất trong hội thoại, nếu có:
${referencedProductName || '- (không xác định)'}

Hội thoại gần đây:
${recentMessages || '- (không có)'}

Tin nhắn hiện tại:
${message}`;

  let lastError = null;
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName, 
        tools: [
    {
      googleSearch: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.3, // Ngưỡng kích hoạt: tự động nhận biết khi nào cần tra Google
        },
      },
    },
  ], });
      const result = await model.generateContent(intentPrompt);
      const text = result?.response?.text?.() || '';
      const parsed = parseAiJsonResponse(text);

      if (parsed && typeof parsed === 'object') {
        const intent = ['product', 'order', 'other'].includes(parsed.intent) ? parsed.intent : 'other';
        const query = typeof parsed.query === 'string' ? parsed.query.trim() : '';

        return {
          intent,
          query: query || referencedProductName || message,
          confidence: Number(parsed.confidence) || 0
        };
      }

      return { intent: 'other', query: referencedProductName || message, confidence: 0 };
    } catch (error) {
      lastError = error;
      if (error?.status === 404 || error?.status === 429 || error?.status === 503) continue;
      break;
    }
  }

  console.error('Lỗi phân loại intent chatbot:', lastError?.message || lastError);
  return { intent: 'other', query: referencedProductName || message, confidence: 0 };
};

const buildOrderSummary = (order) => ({
  _id: order._id?.toString?.() || String(order._id),
  orderId: order.orderId,
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  totalPrice: order.totalPrice,
  createdAt: order.createdAt,
  itemCount: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0,
  detailUrl: `/my-orders?search=${encodeURIComponent(order.orderId)}`
});

const persistChatExchange = async ({ userId, sessionId, userMessage, assistantMessage }) => {
  const query = buildChatHistoryQuery({ userId, sessionId });
  if (!query) return null;

  const update = {
    $setOnInsert: {
      ...(userId ? { userId } : {}),
      ...(sessionId ? { sessionId } : {})
    },
    $push: {
      messages: {
        $each: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantMessage }
        ]
      }
    }
  };

  return ChatHistory.findOneAndUpdate(query, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  });
};

const reserveOrderStock = async (order) => {
  if (!order || order.stockReserved) return false;

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
  }

  order.stockReserved = true;
  return true;
};

const releaseOrderStock = async (order) => {
  if (!order || !order.stockReserved) return false;

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
  }

  order.stockReserved = false;
  return true;
};

const markOrderAsPaid = async (order) => {
  if (!order || order.paymentStatus === 'Đã thanh toán') return false;

  await reserveOrderStock(order);

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { sold: item.quantity } });
  }

  order.paymentStatus = 'Đã thanh toán';
  await order.save();
  return true;
};


// 1. Cấu hình thông tin xác thực Cloudinary từ biến môi trường Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Cấu hình lưu trữ Multer đẩy thẳng lên Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'techshop_products', // Tên thư mục lưu ảnh trên đám mây của bạn
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});
const upload = multer({ storage: storage });

const aiTrainingUploadDir = path.join(process.cwd(), 'uploads', 'ai-training');
if (!fs.existsSync(aiTrainingUploadDir)) {
  fs.mkdirSync(aiTrainingUploadDir, { recursive: true });
}

const aiTrainingUpload = multer({
  storage: multer.diskStorage({
    destination: aiTrainingUploadDir,
    filename: (req, file, callback) => {
      const safeBaseName = path.basename(file.originalname || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
      callback(null, `${Date.now()}-${safeBaseName}`);
    }
  })
});

upload.single = aiTrainingUpload.single.bind(aiTrainingUpload);

// [ADMIN] Upload ảnh sản phẩm cho màn quản lý sản phẩm
app.post('/api/upload', authMiddleware, adminMiddleware, upload.array('imageFiles', 8), async (req, res) => {
  try {
    // Cloudinary trả về URL tuyệt đối trong trường path
    const fileNames = (req.files || []).map(file => file.path); 
    res.json({ success: true, fileNames });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể upload ảnh sản phẩm lên Cloudinary' });
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

// [USER & ADMIN] API Cập nhật thông tin cá nhân
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    const emailOwner = await User.findOne({ email, _id: { $ne: userId } });
    if (emailOwner) {
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng!' });
    }

    user.name = name;
    user.email = email;
    await user.save();

    return res.json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật thông tin' });
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
    const { search, category, brand, minPrice, maxPrice, sort, limit } = req.query;
    let query = {};

    if (search) query.name = { $regex: search, $options: 'i' };
    
    if (category) {
      const catArray = category.split(',');
      query.category = { $in: catArray };
    }
    if (brand) {
      const brandArray = brand.split(',');
      query.brand = { $in: brandArray };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // --- LOGIC XỬ LÝ SẮP XẾP VÀ LIMIT MỚI ---
    let mongooseQuery = Product.find(query);

   if (sort === 'sold') {
      mongooseQuery = mongooseQuery.sort({ sold: -1 }); // Sắp xếp bán chạy nhất
    } else if (sort === 'newest') {
      mongooseQuery = mongooseQuery.sort({ createdAt: -1 }); // Sắp xếp mới nhất
    } else {
      mongooseQuery = mongooseQuery.sort({ createdAt: -1 }); // Mặc định
    }

    if (limit) {
      mongooseQuery = mongooseQuery.limit(Number(limit)); // Giới hạn số lượng (ví dụ chỉ lấy 4 sản phẩm)
    }

    const products = await mongooseQuery;
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách sản phẩm', error });
  }
});
app.get('/api/products/search-suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

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
    
    // Nếu FE truyền chuỗi URL đã upload trước đó, hoặc lấy mảng link từ file vừa submit trực tiếp
    const fileNames = Array.isArray(image) ? image : image ? [image] : (req.files ? req.files.map(file => file.path) : []);
    
    const newProduct = new Product({
      name,
      price: Number(price),
      description,
      category,
      brand,
      stock: Number(stock),
      image: fileNames // Lưu mảng các chuỗi "https://res.cloudinary.com/..." vào DB
    });
    
    await newProduct.save();
    res.status(201).json({ success: true, message: "Thêm sản phẩm thành công!", product: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không thể thêm sản phẩm" });
  }
});

// [ADMIN] Sửa / Cập nhật sản phẩm (Xử lý đổi ảnh trên Cloudinary)
app.put('/api/products/:id', authMiddleware, adminMiddleware, upload.array('image', 5), async (req, res) => {
  try {
    const { name, price, description, category, brand, stock, image } = req.body;
    
    // 1. Tìm sản phẩm hiện tại trong DB để lấy danh sách ảnh cũ
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    // 2. Xác định danh sách ảnh mà Frontend muốn giữ lại hoặc truyền lên
    // (Ant Design khi giữ lại ảnh cũ thường sẽ truyền mảng chuỗi URL qua req.body.image)
    let keptImages = [];
    if (Array.isArray(image)) {
      keptImages = image;
    } else if (image) {
      keptImages = [image];
    }

    // 3. Nếu có file mới được upload lên từ req.files, lấy các đường dẫn URL mới từ Cloudinary
    let newUploadedImages = [];
    if (req.files && req.files.length > 0) {
      newUploadedImages = req.files.map(file => file.path);
    }

    // Mảng ảnh cuối cùng sẽ lưu vào DB = [Các ảnh cũ được giữ lại] + [Các ảnh mới upload]
    const finalImages = [...keptImages, ...newUploadedImages];

    // 4. LOGIC XÓA ẢNH CŨ KHÔNG CÒN DÙNG TRÊN CLOUDINARY
    // Tìm những ảnh có trong DB cũ nhưng KHÔNG nằm trong danh sách giữ lại (finalImages)
    const imagesToDelete = product.image.filter(oldUrl => !finalImages.includes(oldUrl));

    if (imagesToDelete.length > 0) {
      for (const imageUrl of imagesToDelete) {
        try {
          if (imageUrl.includes('cloudinary.com')) {
            // Cắt chuỗi lấy public_id
            const urlParts = imageUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');
            
            if (uploadIndex !== -1) {
              const hasVersion = urlParts[uploadIndex + 1].startsWith('v');
              const startIndex = hasVersion ? uploadIndex + 2 : uploadIndex + 1;
              
              const publicIdWithExtension = urlParts.slice(startIndex).join('/');
              const publicId = publicIdWithExtension.split('.')[0];

              // Gọi lệnh xóa ảnh thừa trên Cloudinary
              await cloudinary.uploader.destroy(publicId);
              console.log(`[Cloudinary] Đã xóa ảnh thừa khi cập nhật: ${publicId}`);
            }
          }
        } catch (imgErr) {
          console.error(`Lỗi khi xóa ảnh thừa trên Cloudinary:`, imgErr);
        }
      }
    }

    // 5. Cập nhật dữ liệu mới vào MongoDB
    const updateData = {
      name,
      price: Number(price),
      description,
      category,
      brand,
      stock: Number(stock),
      image: finalImages // Lưu danh sách mảng ảnh đã đồng bộ mới vào DB
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { returnDocument: 'after' }
    );

    res.json({ success: true, message: "Cập nhật sản phẩm và đồng bộ ảnh thành công!", product: updatedProduct });
  } catch (error) {
    console.error("Lỗi khi cập nhật sản phẩm:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật sản phẩm" });
  }
});

// [ADMIN] Xóa sản phẩm
app.delete('/api/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // 1. Tìm sản phẩm trong DB trước để lấy thông tin mảng ảnh
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    // 2. Tiến hành xóa các ảnh liên quan trên Cloudinary (nếu có)
    if (product.image && product.image.length > 0) {
      // Chạy vòng lặp xóa từng tấm ảnh vì trường `image` của bạn là một mảng []
      for (const imageUrl of product.image) {
        try {
          // Kiểm tra xem có đúng là link của Cloudinary không
          if (imageUrl.includes('cloudinary.com')) {
            // Logic bóc tách lấy public_id: 
            // Cắt chuỗi từ sau chữ '/upload/' -> bỏ v1234567 -> lấy 'techshop_products/tên_file'
            const urlParts = imageUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');
            
            if (uploadIndex !== -1) {
              // Lấy tất cả các phần tử sau '/upload/v123456789/'
              // urlParts[uploadIndex + 1] thường là version (ví dụ: v17168231) nếu nó bắt đầu bằng chữ 'v'
              const hasVersion = urlParts[uploadIndex + 1].startsWith('v');
              const startIndex = hasVersion ? uploadIndex + 2 : uploadIndex + 1;
              
              // Ghép lại và loại bỏ đuôi định dạng (.jpg, .png...) ở cuối cùng
              const publicIdWithExtension = urlParts.slice(startIndex).join('/');
              const publicId = publicIdWithExtension.split('.')[0]; 

              // Gọi API của Cloudinary để xóa file trên mây
              await cloudinary.uploader.destroy(publicId);
              console.log(`[Cloudinary] Đã xóa ảnh thành công: ${publicId}`);
            }
          }
        } catch (imgErr) {
          // Nếu lỗi xóa ảnh thì log ra nhưng không làm gián đoạn luồng xóa sản phẩm chính
          console.error(`Lỗi khi xóa 1 ảnh trên Cloudinary:`, imgErr);
        }
      }
    }

    // 3. Sau khi dọn dẹp ảnh trên mây xong, tiến hành xóa sản phẩm dưới MongoDB
    await Product.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "Xóa sản phẩm và các ảnh liên quan thành công!" });
  } catch (error) {
    console.error("Lỗi khi xóa sản phẩm:", error);
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
      { returnDocument: 'after' }
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
    const updatedReview = await Review.findByIdAndUpdate(req.params.id, { reply }, { returnDocument: 'after' }).populate('productId', 'name image');
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
//              7. API CART
// ==========================================

app.get('/api/cart', authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    return res.json({ success: true, items: serializeCartItems(cart?.items || []) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể tải giỏ hàng' });
  }
});

app.put('/api/cart', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu giỏ hàng không hợp lệ' });
    }

    const normalizedItems = items
      .map(normalizeCartItem)
      .filter(item => item.productId && item.name);

    if (normalizedItems.length === 0) {
      await Cart.findOneAndDelete({ userId: req.user.id });
      return res.json({ success: true, items: [] });
    }

    const savedCart = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { userId: req.user.id, items: normalizedItems },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, items: serializeCartItems(savedCart.items) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể cập nhật giỏ hàng' });
  }
});

app.delete('/api/cart', authMiddleware, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.user.id });
    return res.json({ success: true, items: [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể xóa giỏ hàng' });
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

    // Kiểm tra kho hàng trước khi tạo đơn
    for (const item of items) {
      const product = await Product.findById(item.productId); 
      if (!product || product.stock < item.quantity) return res.status(400).json({ success: false, message: `Sản phẩm không đủ hàng!` });
    }

    const orderId = 'DH' + Math.floor(100000 + Math.random() * 900000);

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

    if (paymentMethod !== 'BANK_TRANSFER') {
      await reserveOrderStock(newOrder);
    }

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

    // Thông báo đơn mới (luôn gửi admin biết có đơn)
    io.to('admin').emit('new_notification', {
      title: 'Đơn hàng mới! 🛒',
      message: `Khách hàng ${customerName} vừa đặt đơn hàng ${orderId}.`,
      type: 'order'
    });
    await Notification.create({ title: 'Đơn hàng mới! 🛒', message: `Khách hàng ${customerName} vừa đặt đơn hàng ${orderId}.`, type: 'order', meta: { orderId } });

    // Nếu client muốn đánh dấu là đã thanh toán ngay khi tạo đơn
    if (req.body.isPaid === true || req.body.paymentStatus === 'Đã thanh toán') {
      await markOrderAsPaid(newOrder);
      io.to('admin').emit('new_notification', {
        title: 'Thanh toán thành công ✅',
        message: `Đơn hàng ${newOrder.orderId} đã được thanh toán tự động/thuận tiện.`,
        type: 'order_paid'
      });
      await Notification.create({ title: 'Thanh toán thành công ✅', message: `Đơn hàng ${newOrder.orderId} đã được thanh toán.`, type: 'order_paid', meta: { orderId: newOrder.orderId } });
      await Notification.create({ userId: newOrder.userId, title: 'Đơn hàng đã thanh toán ✅', message: `Cảm ơn bạn! Đơn hàng ${newOrder.orderId} đã được ghi nhận thanh toán.`, type: 'order_paid', meta: { orderId: newOrder.orderId } });
      await newOrder.reload?.();
    }

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
    if (!order) return res.status(200).json({ success: true });

    // Nếu đã được đánh dấu là đã thanh toán rồi thì thoát
    if (order.paymentStatus === 'Đã thanh toán') return res.json({ success: true });

    if (amount >= order.totalPrice) {
      await markOrderAsPaid(order);

      io.to('admin').emit('new_notification', {
        title: 'Thanh toán tự động từ SePay ✅',
        message: `Đơn hàng ${order.orderId} đã nhận tiền tự động qua SePay.`,
        type: 'order_paid'
      });
      await Notification.create({ title: 'Thanh toán tự động từ SePay ✅', message: `Đơn hàng ${order.orderId} đã nhận tiền tự động qua SePay.`, type: 'order_paid', meta: { orderId: order.orderId } });
      await Notification.create({ userId: order.userId, title: 'Đơn hàng đã thanh toán ✅', message: `Đơn hàng ${order.orderId} đã nhận tiền từ SePay.`, type: 'order_paid', meta: { orderId: order.orderId } });
    }
    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xử lý webhook" });
  }
});

// Public webhook endpoint theo yêu cầu: /webhook/sepay (SePay gửi về khi chuyển khoản hoàn tất)
app.post('/webhook/sepay', async (req, res) => {
  try {
    const transaction = sepayClient.verifyWebhookToken(req.body);
    if (!transaction) return res.status(400).json({ message: "Mã bảo mật webhook không hợp lệ" });

    const { code, amount } = transaction;
    const order = await Order.findOne({ orderId: code });
    if (!order) return res.status(200).json({ success: true });
    if (order.paymentStatus === 'Đã thanh toán') return res.json({ success: true });

    if (amount >= order.totalPrice) {
      await markOrderAsPaid(order);

      io.to('admin').emit('new_notification', {
        title: 'Thanh toán SePay ✅',
        message: `Đơn hàng ${order.orderId} đã thanh toán qua SePay.`,
        type: 'order_paid'
      });
      await Notification.create({ title: 'Thanh toán SePay ✅', message: `Đơn hàng ${order.orderId} đã thanh toán qua SePay.`, type: 'order_paid', meta: { orderId: order.orderId } });
      await Notification.create({ userId: order.userId, title: 'Đơn hàng đã thanh toán ✅', message: `Đơn hàng ${order.orderId} đã thanh toán qua SePay.`, type: 'order_paid', meta: { orderId: order.orderId } });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Webhook sepay error:', error);
    res.status(500).json({ message: 'Lỗi xử lý webhook' });
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

    await releaseOrderStock(order);

    order.status = 'Hủy đơn hàng';
    if (order.paymentStatus === 'Chờ thanh toán') order.paymentStatus = 'Thanh toán thất bại';
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
    await markOrderAsPaid(order); // Nếu đi COD thì khi nhận hàng coi như đã thanh toán

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
      await releaseOrderStock(order);
      order.status = 'Hủy đơn hàng';
      order.paymentStatus = 'Thanh toán thất bại';
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
      paymentStatus: order.paymentStatus === 'Đã thanh toán' ? 'Đã thanh toán' : (order.paymentStatus === 'Thanh toán thất bại' || order.paymentStatus === 'FAILED' ? 'Thất bại' : 'Chờ xử lý'),
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
// [ADMIN] Toggle trạng thái (isActive) của 1 user
app.patch('/api/admin/customers/:id/toggle-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Không cho thay đổi trạng thái của admin qua endpoint này
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Không thể thay đổi trạng thái tài khoản admin' });
    }

    user.isActive = !user.isActive;
    await user.save();

    // Nếu vừa đổi sang 'khóa' thì thông báo qua socket để client logout ngay lập tức
    if (user.isActive === false) {
      try {
        io.to(user._id.toString()).emit('force-logout', { message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên' });

        // Cố gắng ngắt các kết nối socket hiện tại của user
        if (typeof io.in === 'function' && typeof io.in(user._id.toString()).fetchSockets === 'function') {
          const sockets = await io.in(user._id.toString()).fetchSockets();
          for (const s of sockets) {
            try { s.disconnect(true); } catch (e) { /* ignore per-socket errors */ }
          }
        }
      } catch (err) {
        console.error('Lỗi khi phát sự kiện force-logout qua socket:', err);
      }
    }

    res.json({ success: true, message: 'Cập nhật trạng thái người dùng thành công', user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isActive: user.isActive
    }});
  } catch (error) {
    console.error('Lỗi khi đổi trạng thái người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật trạng thái người dùng' });
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

    const notification = await Notification.findOneAndUpdate(query, { isRead: true }, { returnDocument: 'after' });
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

app.post('/api/admin/ai-train', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  const uploadedFilePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn một file PDF hoặc TXT để huấn luyện.' });
    }

    const originalFileName = req.file.originalname || 'document';
    const lowerFileName = originalFileName.toLowerCase();
    const isPdfFile = req.file.mimetype === 'application/pdf' || lowerFileName.endsWith('.pdf');
    const isTextFile = req.file.mimetype === 'text/plain' || req.file.mimetype.startsWith('text/') || lowerFileName.endsWith('.txt');

    if (!isPdfFile && !isTextFile) {
      return res.status(400).json({ success: false, message: 'Chỉ hỗ trợ file PDF hoặc TXT.' });
    }

    let rawText = '';

    if (isPdfFile) {
      const pdfBuffer = fs.readFileSync(uploadedFilePath);
      const pdfData = await pdfParse(pdfBuffer);
      rawText = pdfData?.text || '';
    } else {
      rawText = fs.readFileSync(uploadedFilePath, 'utf8');
    }

    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    const cleanedText = rawText.replace(/\r\n/g, '\n').replace(/\s+\n/g, '\n').trim();
    if (!cleanedText) {
      return res.status(400).json({ success: false, message: 'File không chứa nội dung văn bản hợp lệ.' });
    }

    const chunks = [];
    for (let startIndex = 0; startIndex < cleanedText.length; startIndex += 500) {
      const chunk = cleanedText.slice(startIndex, startIndex + 500).trim();
      if (chunk) {
        chunks.push(chunk);
      }
    }

    const knowledgeRecords = [];
    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk, 'document');
      knowledgeRecords.push({
        fileName: originalFileName,
        content: chunk,
        embedding
      });
    }

    if (knowledgeRecords.length > 0) {
      await Knowledge.insertMany(knowledgeRecords);
    }

    return res.json({
      success: true,
      message: 'Đã nạp dữ liệu tài liệu vào Knowledge thành công.',
      fileName: originalFileName,
      chunkCount: knowledgeRecords.length
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    console.error('Lỗi huấn luyện AI:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Không thể huấn luyện dữ liệu tài liệu cho chatbot.' });
  }
});

// ==========================================
//             8. INTEGRATED AI CHATBOT (PUBLIC)
// ==========================================

const handleChatAsk = async (req, res) => {
  const { message } = req.body;
  const chatIdentity = resolveChatIdentity(req);
  const userQuestion = String(message || '').trim();

  if (!userQuestion) {
    return res.status(400).json({ content: 'Vui lòng nhập nội dung cần hỏi.' });
  }

  try {
    const questionEmbedding = await getEmbedding(userQuestion, 'query');
    const products = await Product.find({}, 'name price stock description category brand image');
    const chatQuery = buildChatHistoryQuery(chatIdentity);
    const chatHistory = chatQuery
      ? await ChatHistory.findOne(chatQuery).lean()
      : null;

    const wantsOrderInfo = isOrderQuestion(userQuestion);
    const currentUserId = chatIdentity.userId;
    const orderCode = extractOrderCodeFromMessage(userQuestion);
    const recentMessages = [...(chatHistory?.messages || []), ...(Array.isArray(req.body.history) ? req.body.history : [])]
      .filter((item) => item && typeof item.content === 'string')
      .slice(-8)
      .map((item) => `${item.role === 'assistant' || item.role === 'ai' ? 'Trợ lý' : 'Khách hàng'}: ${item.content}`)
      .join('\n');

    const chatIntent = await detectChatIntent({
      message: userQuestion,
      recentMessages,
      products
    });
    const productQuery = (chatIntent.query || userQuestion).trim();
    const productMatches = await buildBestProductMatches(productQuery);
    const isFollowUpProductAsk = /\b(xem|cho tôi xem|cho mình xem|show|ảnh|hình|hinh|chi tiết|chi tiet|details|image|photo)\b/i.test(userQuestion);

    if (wantsOrderInfo || chatIntent.intent === 'order') {
      if (!currentUserId) {
        return res.json({
          content: 'Bạn cần đăng nhập để TechShop tra cứu lịch sử đơn hàng cá nhân. Sau khi đăng nhập, bạn có thể xem toàn bộ đơn tại màn quản lý đơn hàng.',
          action: 'order-login-required',
          targetUrl: '/login',
          sessionId: chatIdentity.sessionId || null,
          userId: null
        });
      }

      const orderQuery = { userId: currentUserId };
      if (orderCode) {
        orderQuery.orderId = orderCode;
      }

      const orders = await Order.find(orderQuery).sort({ createdAt: -1 }).limit(3).lean();
      if (orders.length === 0) {
        return res.json({
          content: 'TechShop chưa tìm thấy đơn hàng phù hợp trong tài khoản của bạn. Bạn có thể mở màn quản lý đơn hàng để kiểm tra toàn bộ lịch sử mua hàng.',
          action: 'order-empty',
          targetUrl: '/my-orders',
          orders: [],
          sessionId: chatIdentity.sessionId || null,
          userId: currentUserId
        });
      }

      const orderSummaries = orders.map(buildOrderSummary);
      const primaryOrder = orderSummaries[0];

      return res.json({
        content: `TechShop tìm thấy ${orderSummaries.length} đơn hàng của bạn. Bạn có thể bấm vào nút bên dưới để mở màn quản lý đơn hàng và xem chi tiết từng đơn.`,
        action: 'order-results',
        targetUrl: primaryOrder.detailUrl || '/my-orders',
        orders: orderSummaries,
        sessionId: chatIdentity.sessionId || null,
        userId: currentUserId
      });
    }

    if ((chatIntent.intent === 'product' || isFollowUpProductAsk) && productMatches.length > 0) {
      const productResults = productMatches.map((product) => ({
        _id: product._id?.toString?.() || String(product._id),
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description,
        category: product.category,
        brand: product.brand,
        image: buildProductImagePath(product.image)
      }));

      return res.json({
        content: `TechShop đã tìm thấy ${productResults.length} sản phẩm phù hợp. Bạn có thể bấm để xem chi tiết từng sản phẩm.`,
        action: 'product-results',
        targetUrl: `/product/${productResults[0]._id}`,
        products: productResults,
        sessionId: chatIdentity.sessionId || null,
        userId: currentUserId || null
      });
    }

    let productContext = "Dưới đây là danh sách toàn bộ sản phẩm công nghệ đang có sẵn trong cửa hàng TechShop của chúng ta:\n";
    products.forEach((p, index) => {
      productContext += `${index + 1}. Tên: ${p.name} | Giá: ${p.price.toLocaleString()} VNĐ | Hãng: ${p.brand} | Loại: ${p.category} | Số lượng tồn kho: ${p.stock} chiếc | Mô tả: ${p.description || 'Không có'}\n`;
    });

    const knowledgeDocuments = await Knowledge.find({}).lean();
    const matchedKnowledgeContext = knowledgeDocuments
      .map((document) => ({
        fileName: document.fileName || 'Tài liệu không rõ tên',
        content: document.content || '',
        score: cosineSimilarity(questionEmbedding, document.embedding || [])
      }))
      .filter((document) => document.score > 0.45)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4)
      .map((document) => `[${document.fileName}] (${document.score.toFixed(3)}): ${document.content}`)
      .join('\n\n');

    const systemInstruction = `Bạn là một nhân viên tư vấn bán hàng trực tuyến xuất sắc, thân thiện và am hiểu công nghệ tại cửa hàng "TechShop".
    Nhiệm vụ trọng tâm của bạn là sử dụng ngữ cảnh danh sách sản phẩm được cung cấp bên dưới để trả lời các câu hỏi từ khách hàng một cách ngắn gọn, thuyết phục, tập trung chốt đơn.

    QUY TẮC SỬ DỤNG GOOGLE SEARCH VÀ PHẢN HỒI (BẮT BUỘC):
    1. Khi khách hỏi về thời tiết, tin tức, giá cả... bạn âm thầm sử dụng công cụ Google Search để lấy thông tin thực tế.
    2. TUYỆT ĐỐI KHÔNG ĐƯỢC hiển thị các từ ngữ mô tả quá trình tra cứu ra màn hình chat với khách. 
      Nghiêm cấm xuất hiện các cụm từ như: "Công cụ tìm kiếm:", "Từ khóa:", "Sau khi tra cứu...", "Đang tìm kiếm...", "Google Search:".
    3. Hãy trả lời một cách tự nhiên như một con người vừa xem thời tiết xong. Vào thẳng câu trả lời luôn (Ví dụ: "Dạ, thời tiết tại Thái Nguyên hôm nay đang có...").
    4. Sau khi trả lời xong thông tin ngoài lề, khéo léo bẻ lái ngay sang tư vấn sản phẩm công nghệ của TechShop (iPhone 15 Pro Max, Samsung Galaxy S24 Ultra, MacBook...).
    NHIỆM VỤ CHÍNH:
    - Tư vấn sản phẩm công nghệ, chính sách bảo hành, khuyến mãi của TechShop dựa trên dữ liệu cửa hàng cung cấp (RAG).

    NHIỆM VỤ MỞ RỘNG (KHI KHÁCH HỎI NGOÀI LỀ):
    - Nếu khách hỏi các câu hỏi thời gian thực hoặc kiến thức xã hội (Ví dụ: "thời tiết hôm nay", "giá vàng", "tin tức mới nhất", "toán học",...), bạn ĐƯỢC PHÉP sử dụng công cụ Tìm kiếm Google (đã được tích hợp) để trả lời chính xác, khách quan cho khách.
    - NGUYÊN TẮC BẺ LÁI: Sau khi trả lời xong câu hỏi ngoài lề, hãy khéo léo để lại một câu gợi ý ngắn gọn quay lại chủ đề công nghệ của cửa hàng. 
      (Ví dụ: "Thời tiết Hà Nội hôm nay đang mưa lớn đó ạ, bạn nên ở nhà cho an toàn. À, nếu ở nhà rảnh rỗi bạn có muốn tham khảo qua mấy mẫu tay cầm chơi game đang giảm giá 20% tại TechShop không?").
    --- DỮ LIỆU CỬA HÀNG HIỆN TẠI (TỪ DATABASE) ---
    ${productContext}
    ---------------------------------

    --- DỮ LIỆU TÀI LIỆU BỔ SUNG (RAG) ---
    ${matchedKnowledgeContext || 'Chưa có tài liệu bổ sung phù hợp.'}
    ---------------------------------

    LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
    ${recentMessages || 'Chưa có lịch sử hội thoại trước đó.'}

    Khách hàng nhắn: "${message}"
    Hãy đưa ra câu trả lời tư vấn ngắn gọn, chuyên nghiệp và tối ưu nhất:`;

    if (!genAI) {
      return res.status(500).json({ content: 'Chưa cấu hình GEMINI_API_KEY cho chatbot.' });
    }

    let geminiResult = null;
    let lastGeminiError = null;

    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        geminiResult = await model.generateContent(systemInstruction);
        break;
      } catch (geminiError) {
        lastGeminiError = geminiError;
        if (geminiError?.status === 404 || geminiError?.status === 429 || geminiError?.status === 503) continue;
        throw geminiError;
      }
    }

    if (!geminiResult) {
      throw lastGeminiError || new Error('Không có model Gemini khả dụng.');
    }

    const content = geminiResult?.response?.text?.() || 'Xin lỗi, TechShop chưa lấy được phản hồi từ hệ thống AI.';
    await persistChatExchange({
      ...chatIdentity,
      userMessage: userQuestion,
      assistantMessage: content
    });

    res.json({ content, sessionId: chatIdentity.sessionId || null, userId: chatIdentity.userId || null, action: 'text' });

  } catch (error) {
    console.error("Lỗi AI:", error?.message || error);

    if (error?.status === 429) {
      return res.status(429).json({ content: 'Gemini đang vượt giới hạn quota. Vui lòng thử lại sau vài phút hoặc nâng gói API key.' });
    }

    if (error?.status === 404 || error?.status === 429 || error?.status === 503) {
      return res.status(503).json({ content: 'Model Gemini hiện không khả dụng. Vui lòng kiểm tra cấu hình model trong backend.' });
    }

    res.status(500).json({ content: "Chatbot đang bảo trì, vui lòng quay lại sau!" });
  }
};

app.post('/api/chat', handleChatAsk);
app.post('/api/chat/ask', handleChatAsk);

app.delete('/api/chat/clear', async (req, res) => {
  try {
    const userId = getOptionalUserId(req);
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;
    const query = userId ? { userId } : (sessionId ? { sessionId } : null);

    if (!query) {
      return res.status(400).json({ success: false, message: 'Cần cung cấp sessionId hoặc token đăng nhập để xóa lịch sử chat.' });
    }

    const result = await ChatHistory.deleteMany(query);
    res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể xóa lịch sử chat' });
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
      await releaseOrderStock(order);
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

cron.schedule('0 4 * * *', async () => {
  try {
    const expiredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = await ChatHistory.deleteMany({ updatedAt: { $lt: expiredAt } });
    if (result.deletedCount > 0) {
      console.log(`[Hệ thống] Đã xóa ${result.deletedCount} cuộc hội thoại chat cũ hơn 3 ngày`);
    }
  } catch (error) {
    console.error('Lỗi khi dọn lịch sử chat cũ:', error);
  }
});

// Khởi chạy máy chủ
httpServer.listen(PORT, () => {
  console.log(`🚀 Server TechShop Backend đang chạy mượt mà tại: http://localhost:${PORT}`);
});