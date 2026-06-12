import fs from 'fs';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Knowledge from '../models/Knowledge.js';
import { getEmbedding } from '../ultils/chatHelpers.js';
import { disconnectUserSockets, getIo } from '../services/socket.js';

const pdfParseModule = await import('pdf-parse');
const pdfParse = pdfParseModule?.default || pdfParseModule;

export const getDashboardStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    const validOrders = await Order.find({
      $or: [{ paymentStatus: 'Đã thanh toán' }, { status: 'Đã nhận' }]
    });

    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const pendingOrders = await Order.countDocuments({
      paymentStatus: 'Chờ thanh toán',
      status: { $ne: 'Hủy đơn hàng' }
    });

    const customerMap = {};
    validOrders.forEach((order) => {
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

    const productMap = {};
    validOrders.forEach((order) => {
      order.items.forEach((item) => {
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

    res.json({ totalProducts, totalOrders, totalRevenue, pendingOrders, topCustomers, topProducts });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải số liệu thống kê Dashboard' });
  }
};

export const getReportsChart = async (req, res) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const paidOrders = await Order.find({
      createdAt: { $gte: startOfYear },
      $or: [{ paymentStatus: 'Đã thanh toán' }, { status: 'Đã nhận' }]
    });

    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const totalOrdersCount = paidOrders.length;

    const months = Array.from({ length: 12 }, (_, i) => ({
      name: `Tháng ${i + 1}`,
      DoanhThu: 0,
      DonHang: 0
    }));

    paidOrders.forEach((o) => {
      const m = new Date(o.createdAt).getMonth();
      months[m].DoanhThu += o.totalPrice || 0;
      months[m].DonHang += 1;
    });

    res.json({ months, totalRevenue, totalOrdersCount });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải dữ liệu báo cáo' });
  }
};

export const exportReports = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ paymentStatus: 'Đã thanh toán' }, { status: 'Đã nhận' }]
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
      { header: 'Ngày Tạo', key: 'createdAt', width: 20 }
    ];
    worksheet.getRow(1).font = { bold: true };

    orders.forEach((order) => {
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
};

export const getCustomerStatuses = (req, res) => {
  try {
    const accountStatuses = [
      { label: 'Đang hoạt động', value: 'true' },
      { label: 'Đã khóa', value: 'false' }
    ];
    res.json({ success: true, data: accountStatuses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách trạng thái tài khoản' });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const { search, status, date } = req.query;
    const query = { role: 'customer' };

    if (status) query.isActive = status === 'true';
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tải dữ liệu người dùng' });
  }
};

export const toggleCustomerStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Không thể thay đổi trạng thái tài khoản admin' });
    }

    user.isActive = !user.isActive;
    await user.save();

    if (user.isActive === false) {
      const io = getIo();
      if (io) {
        io.to(user._id.toString()).emit('force-logout', { message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên' });
      }
      await disconnectUserSockets(user._id.toString());
    }

    res.json({
      success: true,
      message: 'Cập nhật trạng thái người dùng thành công',
      user: { id: user._id, name: user.name, email: user.email, isActive: user.isActive }
    });
  } catch (error) {
    console.error('Lỗi khi đổi trạng thái người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật trạng thái người dùng' });
  }
};

export const trainAI = async (req, res) => {
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
      if (chunk) chunks.push(chunk);
    }

    const knowledgeRecords = [];
    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk, 'document');
      knowledgeRecords.push({ fileName: originalFileName, content: chunk, embedding });
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
};
