import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import sepayClient from '../config/sepay.js';
import { markOrderAsPaid } from '../services/orderStock.js';
import { getIo } from '../services/socket.js';

const handleSePayWebhook = async (req, res, titlePrefix = 'Thanh toán tự động từ SePay ✅') => {
  try {
    const transaction = sepayClient.verifyWebhookToken(req.body);
    if (!transaction) return res.status(400).json({ message: 'Mã bảo mật webhook không hợp lệ' });

    const { code, amount } = transaction;
    const order = await Order.findOne({ orderId: code });
    if (!order) return res.status(200).json({ success: true });
    if (order.paymentStatus === 'Đã thanh toán') return res.json({ success: true });

    if (amount >= order.totalPrice) {
      await markOrderAsPaid(order);

      const io = getIo();
      if (io) {
        io.to('admin').emit('new_notification', {
          title: titlePrefix,
          message: `Đơn hàng ${order.orderId} đã nhận tiền tự động qua SePay.`,
          type: 'order_paid'
        });
      }

      if (order.userId) {
          io.to(order.userId.toString()).emit('order_payment_updated', {
            orderId: order.orderId,
            paymentStatus: 'Đã thanh toán'
          });
        }

      io.to('admin').emit('admin_order_updated', {
          orderId: order.orderId,
          paymentStatus: 'Đã thanh toán'
        });

      await Notification.create({
        title: titlePrefix,
        message: `Đơn hàng ${order.orderId} đã nhận tiền tự động qua SePay.`,
        type: 'order_paid',
        meta: { orderId: order.orderId }
      });
      await Notification.create({
        userId: order.userId,
        title: 'Đơn hàng đã thanh toán ✅',
        message: `Đơn hàng ${order.orderId} đã nhận tiền từ SePay.`,
        type: 'order_paid',
        meta: { orderId: order.orderId }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Webhook sepay error:', error);
    return res.status(500).json({ message: 'Lỗi xử lý webhook' });
  }
};

export const sepayWebhook = (req, res) => handleSePayWebhook(req, res, 'Thanh toán tự động từ SePay ✅');
export const sepayWebhookAlt = (req, res) => handleSePayWebhook(req, res, 'Thanh toán SePay ✅');
