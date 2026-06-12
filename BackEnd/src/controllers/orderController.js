import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';
import sepayClient from '../config/sepay.js';
import { removeVietnameseTones } from '../ultils/helpers.js';
import { reserveOrderStock, releaseOrderStock, markOrderAsPaid } from '../services/orderStock.js';
import { sendOrderConfirmationEmail } from '../services/emailService.js';
import { getIo } from '../services/socket.js';

const emitNotification = (room, payload) => {
  const io = getIo();
  if (io) io.to(room).emit('new_notification', payload);
};

const matchProvinceFromAddress = async (shippingAddress) => {
  let matchedProvinceName = 'Khác';
  const provincesList = await mongoose.connection.db.collection('provinces').find({}).toArray();
  const cleanShippingAddress = removeVietnameseTones(shippingAddress);

  for (const prov of provincesList) {
    const cleanProvName = removeVietnameseTones(prov.name);
    if (cleanShippingAddress.includes(cleanProvName)) {
      matchedProvinceName = prov.name;
      break;
    }
  }

  return matchedProvinceName;
};

export const createOrder = async (req, res) => {
  try {
    const { customerName, phoneNumber, shippingAddress, paymentMethod, items, totalPrice } = req.body;
    const userId = req.user.id;
    const provinceFilter = await matchProvinceFromAddress(shippingAddress);

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: 'Sản phẩm không đủ hàng!' });
      }
    }

    const orderId = 'DH' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = new Order({
      orderId,
      userId,
      customerName,
      phoneNumber,
      shippingAddress,
      provinceFilter,
      paymentMethod,
      items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
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
        operation: 'PURCHASE',
        payment_method: 'BANK_TRANSFER',
        order_invoice_number: orderId,
        order_amount: Number(totalPrice),
        currency: 'VND',
        order_description: `Thanh toán đơn hàng ${orderId}`,
        success_url: `${frontendOrigin}/my-orders?status=success&orderId=${orderId}`,
        cancel_url: `${frontendOrigin}/my-orders?status=cancel&orderId=${orderId}`
      });
      const checkoutUrl = sepayClient.checkout.initCheckoutUrl();
      newOrder.paymentUrl = checkoutUrl;
      paymentGateway = { checkoutUrl, fields: checkoutFields };
    }

    await newOrder.save();

    try {
      const user = await User.findById(userId).select('email');
      if (user && user.email) {
        sendOrderConfirmationEmail(user.email, newOrder);
      }
    } catch (mailErr) {
      console.error('Lỗi truy vấn email người dùng:', mailErr);
    }

    emitNotification('admin', {
      title: 'Đơn hàng mới! 🛒',
      message: `Khách hàng ${customerName} vừa đặt đơn hàng ${orderId}.`,
      type: 'order'
    });
    await Notification.create({
      title: 'Đơn hàng mới! 🛒',
      message: `Khách hàng ${customerName} vừa đặt đơn hàng ${orderId}.`,
      type: 'order',
      meta: { orderId }
    });

    if (req.body.isPaid === true || req.body.paymentStatus === 'Đã thanh toán') {
      await markOrderAsPaid(newOrder);
      emitNotification('admin', {
        title: 'Thanh toán thành công ✅',
        message: `Đơn hàng ${newOrder.orderId} đã được thanh toán tự động/thuận tiện.`,
        type: 'order_paid'
      });
      await Notification.create({
        title: 'Thanh toán thành công ✅',
        message: `Đơn hàng ${newOrder.orderId} đã được thanh toán.`,
        type: 'order_paid',
        meta: { orderId: newOrder.orderId }
      });
      await Notification.create({
        userId: newOrder.userId,
        title: 'Đơn hàng đã thanh toán ✅',
        message: `Cảm ơn bạn! Đơn hàng ${newOrder.orderId} đã được ghi nhận thanh toán.`,
        type: 'order_paid',
        meta: { orderId: newOrder.orderId }
      });
    }

    return res.status(201).json({ success: true, order: newOrder, paymentGateway });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý đơn hàng!' });
  }
};

const buildOrderQuery = (req, { forceUserId = null } = {}) => {
  const { search, status, paymentMethod, province, date } = req.query;
  const query = forceUserId ? { userId: forceUserId } : {};

  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (province) query.shippingAddress = { $regex: province, $options: 'i' };
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

  return query;
};

export const getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find(buildOrderQuery(req)).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tải đơn hàng' });
  }
};

export const getCustomerOrders = async (req, res) => {
  try {
    const query = buildOrderQuery(req, { forceUserId: req.user.id });
    if (req.query.search && !query.$or) {
      query.orderId = { $regex: req.query.search, $options: 'i' };
    }
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách đơn hàng' });
  }
};

export const getOrderStatuses = (req, res) => {
  try {
    const statuses = Order.schema.path('status').enumValues;
    res.json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách trạng thái' });
  }
};

export const getPaymentMethods = (req, res) => {
  try {
    const paymentMethods = Order.schema.path('paymentMethod').enumValues;
    res.json({ success: true, data: paymentMethods });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách phương thức thanh toán' });
  }
};

export const cancelCustomerOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

    if (order.status !== 'Chờ xác nhận') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã được xử lý, bạn không thể tự hủy!' });
    }

    await releaseOrderStock(order);
    order.status = 'Hủy đơn hàng';
    if (order.paymentStatus === 'Chờ thanh toán') order.paymentStatus = 'Thanh toán thất bại';
    await order.save();

    emitNotification('admin', {
      title: 'Đơn hàng bị hủy ⚠️',
      message: `Đơn hàng ${order.orderId} đã bị khách hàng hủy.`,
      type: 'order_cancel'
    });
    await Notification.create({
      title: 'Đơn hàng bị hủy ⚠️',
      message: `Đơn hàng ${order.orderId} đã bị khách hàng hủy.`,
      type: 'order_cancel',
      meta: { orderId: order.orderId }
    });
    await Notification.create({
      userId: order.userId,
      title: 'Đơn hàng bị hủy ⚠️',
      message: `Đơn hàng ${order.orderId} của bạn đã bị hủy.`,
      type: 'order_cancel',
      meta: { orderId: order.orderId }
    });

    res.json({ success: true, message: 'Bạn đã hủy đơn hàng thành công!', order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi khách hàng hủy đơn' });
  }
};

export const receiveCustomerOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

    if (order.status !== 'Đang giao') {
      return res.status(400).json({ success: false, message: 'Đơn hàng chưa được giao, không thể xác nhận!' });
    }

    order.status = 'Đã nhận';
    await markOrderAsPaid(order);

    emitNotification('admin', {
      title: 'Khách hàng đã nhận hàng ✅',
      message: `Đơn hàng ${order.orderId} đã được khách hàng xác nhận đã nhận.`,
      type: 'order_received'
    });
    await Notification.create({
      title: 'Khách hàng đã nhận hàng ✅',
      message: `Đơn hàng ${order.orderId} đã được khách hàng xác nhận đã nhận.`,
      type: 'order_received',
      meta: { orderId: order.orderId }
    });
    await Notification.create({
      userId: order.userId,
      title: 'Xác nhận nhận hàng thành công ✅',
      message: `Bạn đã xác nhận nhận hàng cho đơn ${order.orderId}.`,
      type: 'order_received',
      meta: { orderId: order.orderId }
    });

    res.json({ success: true, message: 'Xác nhận đã nhận hàng thành công. Cảm ơn bạn!', order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xác nhận nhận hàng' });
  }
};

export const updateAdminOrder = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

    if (status === 'Hủy đơn hàng' && order.status !== 'Hủy đơn hàng') {
      if (order.status === 'Đã nhận') {
        return res.status(400).json({ success: false, message: 'Đơn hàng đã hoàn thành, không thể hủy đè!' });
      }
      await releaseOrderStock(order);
      order.status = 'Hủy đơn hàng';
      order.paymentStatus = 'Thanh toán thất bại';
    } else {
      order.status = status;
      if (paymentStatus) order.paymentStatus = paymentStatus;
    }

    await order.save();

    emitNotification(order.userId.toString(), {
      title: 'Cập nhật đơn hàng 📦',
      message: `Đơn hàng ${order.orderId} của bạn đã chuyển sang trạng thái: ${status}.`,
      type: 'order_status'
    });
    await Notification.create({
      userId: order.userId,
      title: 'Cập nhật đơn hàng 📦',
      message: `Đơn hàng ${order.orderId} của bạn đã chuyển sang trạng thái: ${status}.`,
      type: 'order_status',
      meta: { orderId: order.orderId, status }
    });

    res.json({ success: true, message: 'Cập nhật trạng thái đơn thành công!', order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể cập nhật đơn hàng' });
  }
};

export const exportOrdersExcel = async (req, res) => {
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
      { header: 'Ngày Tạo', key: 'createdAt', width: 20 }
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
        createdAt: new Date(order.createdAt).toLocaleString('vi-VN')
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + `Bao_Cao_Don_Hang_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo file báo cáo Excel' });
  }
};

export { markOrderAsPaid };
