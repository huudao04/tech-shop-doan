import cron from 'node-cron';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import ChatHistory from '../models/ChatHistory.js';
import { releaseOrderStock } from './orderStock.js';
import { releaseVoucher } from '../controllers/voucherController.js';

export default function initCron(io) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const expirationTime = new Date(Date.now() - 5 * 60 * 1000);
      const expiredOrders = await Order.find({
        paymentStatus: 'Chờ thanh toán',
        paymentMethod: 'BANK_TRANSFER',
        status: 'Chờ xác nhận',
        createdAt: { $lt: expirationTime }
      });

      for (const order of expiredOrders) {
        await releaseOrderStock(order);
        if (order.voucherCode) {
          await releaseVoucher(order.voucherCode, order.userId);
        }
        order.paymentStatus = 'Thanh toán thất bại';
        order.status = 'Hủy đơn hàng';
        await order.save();

        if (io) io.to('admin').emit('new_notification', {
          title: 'Đơn hàng treo đã bị hủy ⏰',
          message: `Đơn hàng ${order.orderId} đã tự động hủy do quá 5 phút chưa thanh toán.`,
          type: 'order_auto_cancel'
        });
        if (io && order.userId) {
          io.to(order.userId.toString()).emit('new_notification', {
            title: 'Đơn hàng đã bị hủy ⏰',
            message: `Đơn hàng ${order.orderId} của bạn đã tự động hủy do quá 5 phút chưa thanh toán.`,
            type: 'order_auto_cancel'
          });
        }

        await Notification.create({
          title: 'Đơn hàng treo đã bị hủy ⏰',
          message: `Đơn hàng ${order.orderId} đã tự động hủy do quá 5 phút chưa thanh toán.`,
          type: 'order_auto_cancel',
          meta: { orderId: order.orderId }
        });
        await Notification.create({
          userId: order.userId,
          title: 'Đơn hàng đã bị hủy ⏰',
          message: `Đơn hàng ${order.orderId} của bạn đã tự động hủy do quá 5 phút chưa thanh toán.`,
          type: 'order_auto_cancel',
          meta: { orderId: order.orderId }
        });
        console.log(`[Cron] Đã tự động hủy đơn treo: ${order.orderId}`);
      }
    } catch (error) {
      console.error('[Cron] Lỗi khi quét và hủy đơn hàng treo:', error);
    }
  });

  cron.schedule('0 3 * * *', async () => {
    try {
      const expiredAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await Notification.deleteMany({ createdAt: { $lt: expiredAt } });
      if (result.deletedCount > 0) {
        console.log(`[Cron] Đã xóa ${result.deletedCount} thông báo cũ hơn 7 ngày`);
      }
    } catch (error) {
      console.error('[Cron] Lỗi khi dọn thông báo cũ:', error);
    }
  });

  cron.schedule('0 4 * * *', async () => {
    try {
      const expiredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = await ChatHistory.deleteMany({ updatedAt: { $lt: expiredAt } });
      if (result.deletedCount > 0) {
        console.log(`[Cron] Đã xóa ${result.deletedCount} cuộc hội thoại chat cũ hơn 3 ngày`);
      }
    } catch (error) {
      console.error('[Cron] Lỗi khi dọn lịch sử chat cũ:', error);
    }
  });
}
