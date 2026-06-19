import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminOrderRoutes from './routes/adminOrderRoutes.js';
import customerOrderRoutes from './routes/customerOrderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import customerReviewRoutes from './routes/customerReviewRoutes.js';
import adminReviewRoutes from './routes/adminReviewRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import voucherRoutes from './routes/vouchersRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js';
import { sepayWebhookAlt } from './controllers/webhookController.js';
import initCron from './services/cronJobs.js';
import { initSocket } from './services/socket.js';

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', catalogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/customer/orders', customerOrderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/customer/reviews', customerReviewRoutes);
app.use('/api/admin/reviews', adminReviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', webhookRoutes);
app.post('/webhook/sepay', sepayWebhookAlt);
app.use('/api/shipping', shippingRoutes);
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TechShop backend đang chạy.' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://frontend-techshop.onrender.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

initSocket(io);

const startServer = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`🚀 TechShop Backend listening at http://localhost:${PORT}`);
  });

  try {
    initCron(io);
    console.log('Cron jobs initialized.');
  } catch (e) {
    console.error('Failed to initialize cron jobs:', e);
  }
};

startServer().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
