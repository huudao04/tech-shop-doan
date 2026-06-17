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
    const { range } = req.query;
    
    let startDate = new Date();
    let monthsDivider = 1;
    let rangeText = '1 Tháng Gần Nhất';
    let timeGroupType = 'day'; 

    if (range === '6months') {
      startDate.setMonth(startDate.getMonth() - 6);
      monthsDivider = 6;
      rangeText = '6 Tháng Gần Nhất';
      timeGroupType = 'month';
    } else if (range === '1year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
      monthsDivider = 12;
      rangeText = '1 Năm Gần Nhất';
      timeGroupType = 'month';
    } else {
      startDate.setMonth(startDate.getMonth() - 1);
      monthsDivider = 1;
      rangeText = '1 Tháng Gần Nhất';
      timeGroupType = 'day';
    }

    const validOrders = await Order.find({
      createdAt: { $gte: startDate },
      $or: [{ paymentStatus: 'Đã thanh toán' }, { status: 'Đã nhận' }]
    }).sort({ createdAt: 1 });

    const totalProducts = await Product.countDocuments();
    const totalOrdersInPeriod = validOrders.length;
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const pendingOrders = await Order.countDocuments({
      createdAt: { $gte: startDate },
      paymentStatus: 'Chờ thanh toán',
      status: { $ne: 'Hủy đơn hàng' }
    });

    // LẤY THÔNG TIN GIÁ NHẬP TỪ DATABASE ĐỂ TÍNH LỢI NHUẬN
    // Tạo map { [productId]: costPrice } để truy xuất với độ phức tạp O(1)
    const allProducts = await Product.find({}, '_id costPrice');
    const costPriceMap = {};
    allProducts.forEach(p => {
      costPriceMap[p._id.toString()] = p.costPrice || 0;
    });

    const productMap = {};
    const timelineMap = {}; 

    validOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      
      let timeKey = '';
      if (timeGroupType === 'day') {
        timeKey = orderDate.toLocaleDateString('vi-VN'); 
      } else {
        timeKey = `Tháng ${orderDate.getMonth() + 1}/${orderDate.getFullYear()}`; 
      }

      if (!timelineMap[timeKey]) {
        timelineMap[timeKey] = [];
      }

      order.items.forEach((item) => {
        const pId = item.productId.toString();
        const itemPrice = item.price || 0;
        const itemQty = item.quantity || 0;
        const itemRevenue = itemPrice * itemQty;
        
        // Lấy giá nhập từ map, nếu không có thì mặc định bằng 0 hoặc dùng giá bán tùy logic
        const itemCostPrice = costPriceMap[pId] !== undefined ? costPriceMap[pId] : 0;
        const itemTotalCost = itemCostPrice * itemQty;
        const itemProfit = itemRevenue - itemTotalCost;

        // Tính toán cho Tab 1 & Tab mới (Phân tích lợi nhuận)
        if (!productMap[pId]) {
          productMap[pId] = { 
            name: item.name, 
            price: itemPrice, 
            costPrice: itemCostPrice, // Lưu thêm giá nhập vào map
            totalQty: 0, 
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0
          };
        }
        productMap[pId].totalQty += itemQty;
        productMap[pId].totalRevenue += itemRevenue;
        productMap[pId].totalCost += itemTotalCost;
        productMap[pId].totalProfit += itemProfit;

        const formattedDate = orderDate.toLocaleDateString('vi-VN'); 
        const formattedTime = orderDate.toLocaleTimeString('vi-VN'); 
        
        timelineMap[timeKey].push({
          productName: item.name,
          qtySold: itemQty,
          revenue: itemRevenue,
          exactTime: `${formattedTime} - ${formattedDate}`, 
          orderId: order.orderId
        });
      });
    });

    const topProducts = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Tính tổng lợi nhuận gộp toàn hệ thống trong kỳ báo cáo
    const totalCostAll = topProducts.reduce((sum, p) => sum + p.totalCost, 0);
    const totalProfitAll = topProducts.reduce((sum, p) => sum + p.totalProfit, 0);

    // Khởi tạo ExcelJS
    const workbook = new ExcelJS.Workbook();

    // ==========================================
    // TAB 1: TỔNG QUAN & PHÂN PHÂN KHÚC CHIẾN LƯỢC
    // ==========================================
    const summarySheet = workbook.addWorksheet('Tổng Quan Chiến Lược');
    summarySheet.mergeCells('A1:F1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `HỆ THỐNG PHÂN TÍCH KPI KINH DOANH SẢN PHẨM (${rangeText.toUpperCase()})`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 40;

    summarySheet.getCell('A3').value = `Báo cáo xuất ngày: ${new Date().toLocaleString('vi-VN')}`;
    const kpiData = [
      ['Tổng số mã hàng hệ thống:', totalProducts, 'mặt hàng'],
      ['Đơn hàng phát sinh hoàn thành:', totalOrdersInPeriod, 'đơn'],
      ['Tổng doanh thu thực tế thu về:', totalRevenue, 'VNĐ'],
      ['Đơn hàng chưa quyết toán (Tồn đọng):', pendingOrders, 'đơn']
    ];
    kpiData.forEach((kpi, idx) => {
      const rNum = 5 + idx;
      summarySheet.getCell(`A${rNum}`).value = kpi[0];
      summarySheet.getCell(`B${rNum}`).value = kpi[1];
      summarySheet.getCell(`A${rNum}`).font = { bold: true };
      if(kpi[0].includes('doanh thu')) {
        summarySheet.getCell(`B${rNum}`).font = { bold: true, color: { argb: 'FF10B981' } };
        summarySheet.getCell(`B${rNum}`).numberFormat = '#,##0';
      }
    });

    const startRowTopProd = 11;
    summarySheet.getCell(`A${startRowTopProd}`).value = 'MA TRẬN HIỆU SUẤT KINH DOANH (ĐÃ TÍCH HỢP GIÁ TRỊ MẶT HÀNG)';
    summarySheet.getCell(`A${startRowTopProd}`).font = { bold: true, size: 11, color: { argb: 'FF3B82F6' } };

    const prodHeaderRow = summarySheet.getRow(startRowTopProd + 1);
    prodHeaderRow.values = ['Tên Sản Phẩm', 'Đơn Giá (VNĐ)', 'Tổng Đã Bán', 'Tổng Doanh Thu', 'Tốc Độ / Tháng', 'Đánh Giá Hiệu Suất Vận Hành'];
    prodHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    prodHeaderRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; });

    topProducts.forEach((prod, idx) => {
      const currRow = summarySheet.getRow(startRowTopProd + 2 + idx);
      const monthlyVelocity = parseFloat((prod.totalQty / monthsDivider).toFixed(1));
      
      let performanceStatus = '';
      if (prod.price >= 5000000) { 
        if (monthlyVelocity >= 3) performanceStatus = '⭐ Siêu phẩm Hi-End (Doanh thu đột phá - Ưu tiên duy trì)';
        else if (monthlyVelocity >= 1) performanceStatus = '📈 Hàng giá trị cao tiêu thụ ổn định';
        else performanceStatus = '⚠️ Hàng cao cấp kén khách - Lưu kho ít tránh đọng vốn';
      } else { 
        if (monthlyVelocity >= 25) performanceStatus = '🔥 Phụ kiện bán cực chạy (Tốc độ xoay vòng kho nhanh)';
        else if (monthlyVelocity >= 8) performanceStatus = '🛒 Sức mua đều đặn';
        else performanceStatus = '❌ Hiệu suất kém - Cần giải phóng tồn kho';
      }

      currRow.values = [prod.name, prod.price, prod.totalQty, prod.totalRevenue, `${monthlyVelocity} sp/th`, performanceStatus];
      currRow.getCell(2).numberFormat = '#,##0';
      currRow.getCell(4).numberFormat = '#,##0';
    });
    summarySheet.columns = [{ width: 35 }, { width: 15 }, { width: 12 }, { width: 18 }, { width: 15 }, { width: 45 }];

    // ==========================================
    // TAB NEW: PHÂN TÍCH LỢI NHUẬN TỪM MẶT HÀNG
    // ==========================================
    const profitSheet = workbook.addWorksheet('Phân Tích Lợi Nhuận');
    profitSheet.mergeCells('A1:G1');
    const profitTitleCell = profitSheet.getCell('A1');
    profitTitleCell.value = `BÁO CÁO PHÂN TÍCH GIÁ NHẬP & BIÊN ĐỘ LỢI NHUẬN GỘP (${rangeText.toUpperCase()})`;
    profitTitleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    profitTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // Màu xanh Teal sang trọng
    profitTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    profitSheet.getRow(1).height = 35;

    // Hiển thị KPI tài chính tổng quát ở trên đầu Tab Lợi nhuận
    profitSheet.getCell('A3').value = 'Tổng Doanh Thu Kỳ:';
    profitSheet.getCell('B3').value = totalRevenue;
    profitSheet.getCell('B3').numberFormat = '#,##0';
    profitSheet.getCell('B3').font = { bold: true };

    profitSheet.getCell('A4').value = 'Tổng Giá Vốn (Nhập):';
    profitSheet.getCell('B4').value = totalCostAll;
    profitSheet.getCell('B4').numberFormat = '#,##0';
    profitSheet.getCell('B4').font = { bold: true, color: { argb: 'DC2626' } };

    profitSheet.getCell('A5').value = 'Tổng Lợi Nhuận Gộp:';
    profitSheet.getCell('B5').value = totalProfitAll;
    profitSheet.getCell('B5').numberFormat = '#,##0';
    profitSheet.getCell('B5').font = { bold: true, color: { argb: 'FF16A34A' } };

    // Tạo bảng chi tiết
    const profitHeaderRow = profitSheet.getRow(7);
    profitHeaderRow.values = ['Tên Sản Phẩm', 'Giá Nhập (Vốn)', 'Giá Bán', 'Số Lượng Bán', 'Tổng Doanh Thu', 'Tổng Giá Vốn', 'Lợi Nhuận Gộp'];
    profitHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    profitHeaderRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; });

    topProducts.forEach((prod, idx) => {
      const currRow = profitSheet.getRow(8 + idx);
      currRow.values = [
        prod.name, 
        prod.costPrice, 
        prod.price, 
        prod.totalQty, 
        prod.totalRevenue, 
        prod.totalCost, 
        prod.totalProfit
      ];
      // Định dạng tiền tệ VND cho dễ nhìn
      currRow.getCell(2).numberFormat = '#,##0';
      currRow.getCell(3).numberFormat = '#,##0';
      currRow.getCell(5).numberFormat = '#,##0';
      currRow.getCell(6).numberFormat = '#,##0';
      currRow.getCell(7).numberFormat = '#,##0';

      // Đổi màu chữ cột Lợi Nhuận sang xanh lá để kích thích thị giác
      currRow.getCell(7).font = { color: { argb: 'FF16A34A' }, bold: true };
    });
    profitSheet.columns = [{ width: 35 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }];

    // ==========================================
    // TAB 2: PHÂN TÍCH TIẾN TRÌNH THỜI GIAN VÀ MẬT ĐỘ MUA BÁN
    // ==========================================
    const timelineSheet = workbook.addWorksheet('Dòng Thời Gian Mua Bán');
    
    timelineSheet.getCell('A1').value = `LỊCH SỬ PHÂN PHỐI SẢN PHẨM THEO MỐC THỜI GIAN VÀ BIÊN ĐỘ (${rangeText.toUpperCase()})`;
    timelineSheet.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    timelineSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    timelineSheet.mergeCells('A1:E1');
    timelineSheet.getRow(1).height = 30;

    let currentTimelineRow = 3;

    Object.keys(timelineMap).sort().forEach((timeBlock) => {
      timelineSheet.getCell(`A${currentTimelineRow}`).value = `MỐC THỜI GIAN: ${timeBlock}`;
      timelineSheet.getCell(`A${currentTimelineRow}`).font = { bold: true, color: { argb: 'FF1E3A8A' } };
      timelineSheet.mergeCells(`A${currentTimelineRow}:E${currentTimelineRow}`);
      
      const subHeader = timelineSheet.getRow(currentTimelineRow + 1);
      subHeader.values = ['Mã Đơn Gốc', 'Tên Sản Phẩm Được Bán', 'Số Lượng', 'Doanh Thu', 'Thời Gian Xuất Đơn Chi Tiết'];
      subHeader.font = { bold: true, size: 10 };
      subHeader.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; });

      let totalQtyInBlock = 0;
      let totalRevInBlock = 0;

      timelineMap[timeBlock].forEach((item) => {
        currentTimelineRow += 1;
        const row = timelineSheet.getRow(currentTimelineRow + 1);
        row.values = [item.orderId, item.productName, item.qtySold, item.revenue, item.exactTime];
        row.getCell(4).numberFormat = '#,##0';

        totalQtyInBlock += item.qtySold;
        totalRevInBlock += item.revenue;
      });

      currentTimelineRow += 1;
      const totalRow = timelineSheet.getRow(currentTimelineRow + 1);
      totalRow.values = ['TỔNG CỘNG TRONG MỐC:', '', totalQtyInBlock, totalRevInBlock, ''];
      totalRow.font = { bold: true, italic: true };
      totalRow.getCell(4).numberFormat = '#,##0';

      currentTimelineRow += 3;
    });

    timelineSheet.columns = [{ width: 15 }, { width: 40 }, { width: 12 }, { width: 18 }, { width: 25 }];

    // ==========================================
    // TAB 3: CHI TIẾT ĐƠN HÀNG (Sổ cái kiểm toán)
    // ==========================================
    const orderSheet = workbook.addWorksheet('Sổ Chi Tiết Đơn Hàng');
    orderSheet.columns = [
      { header: 'Mã Đơn Hàng', key: 'orderId', width: 15 },
      { header: 'Tên Khách Hàng', key: 'customerName', width: 22 },
      { header: 'Số Điện Thoại', key: 'phoneNumber', width: 15 },
      { header: 'Phương Thức', key: 'paymentMethod', width: 15 },
      { header: 'Tổng Tiền (VNĐ)', key: 'totalPrice', width: 18 },
      { header: 'Trạng Thái Đơn', key: 'status', width: 15 },
      { header: 'Thanh Toán', key: 'paymentStatus', width: 18 },
      { header: 'Ngày Tạo Đơn', key: 'createdAt', width: 20 }
    ];
    const headerRow = orderSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; });

    validOrders.forEach((o) => {
      const row = orderSheet.addRow({
        orderId: o.orderId,
        customerName: o.customerName,
        phoneNumber: o.phoneNumber,
        paymentMethod: o.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'COD',
        totalPrice: o.totalPrice,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: new Date(o.createdAt).toLocaleString('vi-VN')
      });
      row.getCell('totalPrice').numberFormat = '#,##0';
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Bao_Cao_Chien_Luoc_TechShop_${range}_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Lỗi phân tích báo cáo nâng cao:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi kết xuất dữ liệu cấu trúc ma trận.' });
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
