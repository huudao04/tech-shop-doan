import Voucher from '../models/Voucher.js'; 

// ==========================================
// 1. NGƯỜI DÙNG: KIỂM TRA MÃ GIẢM GIÁ (CHECKOUT)
// ==========================================
export const checkVoucher = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    
    // Thường authMiddleware của bạn sẽ gán user vào req.user hoặc req.userId. 
    // Bạn check lại xem trong dự án đang dùng req.user._id hay req.userId nhé.
    const userId = req.user?._id || req.userId; 

    if (!code) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mã giảm giá" });
    }

    // Tìm mã (Chuyển chữ hoa và check trạng thái isActive)
    const voucher = await Voucher.findOne({ code: code.toUpperCase(), isActive: true });
    
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa" });
    }

    // 1. Kiểm tra thời hạn
    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã hết hạn hoặc chưa đến thời gian áp dụng" });
    }

    // 2. Kiểm tra tổng số lượt sử dụng của hệ thống
    if (voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({ success: false, message: "Mã giảm giá đã hết lượt sử dụng" });
    }

    // 3. Kiểm tra giá trị đơn hàng tối thiểu
    if (orderAmount < voucher.minOrderValue) {
      return res.status(400).json({ 
        success: false, 
        message: `Mã này chỉ áp dụng cho đơn hàng từ ${voucher.minOrderValue.toLocaleString()} VNĐ trở lên` 
      });
    }

    // 4. Kiểm tra giới hạn User cụ thể (Đặc quyền)
    if (voucher.specificUsers && voucher.specificUsers.length > 0) {
      const isAllowed = voucher.specificUsers.some(id => id.toString() === userId.toString());
      if (!isAllowed) {
        return res.status(403).json({ success: false, message: "Mã giảm giá này không dành cho tài khoản của bạn" });
      }
    }

    // 5. Kiểm tra xem User này đã từng dùng mã này chưa
    const hasUsed = voucher.usedByUsers.some(id => id.toString() === userId.toString());
    if (hasUsed) {
      return res.status(400).json({ success: false, message: "Bạn đã sử dụng mã giảm giá này cho đơn hàng trước rồi" });
    }

    // Nếu vượt qua tất cả các bước check => Hợp lệ
    return res.status(200).json({
      success: true,
      message: "Áp dụng mã giảm giá thành công",
      discountValue: voucher.discountValue
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

// ==========================================
// 2. ADMIN: TẠO MÃ GIẢM GIÁ MỚI (CMS)
// ==========================================
export const createVoucher = async (req, res) => {
  try {
    const { 
      code, 
      discountValue, 
      minOrderValue, 
      usageLimit, 
      startDate, 
      endDate, 
      specificUsers 
    } = req.body;

    // Kiểm tra trùng mã
    const existingVoucher = await Voucher.findOne({ code: code.toUpperCase() });
    if (existingVoucher) {
      return res.status(400).json({ success: false, message: "Mã giảm giá này đã tồn tại" });
    }

    const newVoucher = new Voucher({
      code: code.toUpperCase(),
      discountValue,
      minOrderValue: minOrderValue || 0,
      usageLimit,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      specificUsers: specificUsers || [] // Nếu trống thì áp dụng cho tất cả
    });

    await newVoucher.save();
    return res.status(201).json({ success: true, message: "Tạo mã giảm giá thành công", data: newVoucher });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi tạo mã giảm giá", error: error.message });
  }
};

// ==========================================
// 3. HELPER HOẶC SERVICE: TRỪ / HOÀN SỐ LƯỢT DÙNG VOUCHER
// ==========================================

// Hàm cắn mã (giảm số lượng khả dụng, lưu user đã dùng)
export const reserveVoucher = async (code, userId) => {
  if (!code) return false;
  try {
    await Voucher.findOneAndUpdate(
      { code: code.toUpperCase() },
      { 
        $inc: { usedCount: 1 }, 
        $push: { usedByUsers: userId } 
      }
    );
    return true;
  } catch (err) {
    console.error('Lỗi khi giữ mã voucher:', err);
    return false;
  }
};

// Hàm nhả mã (tăng lại số lượng khả dụng, xóa user khỏi danh sách đã dùng)
export const releaseVoucher = async (code, userId) => {
  if (!code) return false;
  try {
    await Voucher.findOneAndUpdate(
      { code: code.toUpperCase() },
      { 
        $inc: { usedCount: -1 }, 
        $pull: { usedByUsers: userId } 
      }
    );
    return true;
  } catch (err) {
    console.error('Lỗi khi hoàn mã voucher:', err);
    return false;
  }
};

// ==========================================
// 4. ADMIN: LẤY DANH SÁCH & TÌM KIẾM MÃ GIẢM GIÁ (CMS)
// ==========================================
export const getAdminVouchers = async (req, res) => {
  try {
    const { search, isActive, status } = req.query;
    const query = {};

    // 1. Tìm kiếm theo mã code (Không phân biệt hoa thường, tìm kiếm tương đối)
    if (search) {
      query.code = { $regex: search, $options: 'i' };
    }

    // 2. Lọc theo trạng thái kích hoạt (isActive: true/false)
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // 3. Lọc nâng cao theo tình trạng hiệu lực thực tế dựa theo Schema
    const now = new Date();
    if (status === 'active') {
      // Mã đang còn thời hạn sử dụng và đang bật kích hoạt
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
      query.isActive = true;
    } else if (status === 'expired') {
      // Mã đã quá hạn sử dụng
      query.endDate = { $lt: now };
    } else if (status === 'upcoming') {
      // Mã được lên lịch trước, chưa đến ngày áp dụng
      query.startDate = { $gt: now };
    }

    // Tìm kiếm và sắp xếp theo ngày tạo mới nhất lên đầu
    const vouchers = await Voucher.find(query).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: vouchers.length,
      data: vouchers
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi tìm kiếm mã giảm giá", error: error.message });
  }
};

// ==========================================
// 5. ADMIN: CẬP NHẬT/CẤU HÌNH LẠI MÃ GIẢM GIÁ (CMS)
// ==========================================
export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Nếu thay đổi text của mã code, cần chuẩn hóa chữ hoa và check trùng với các ID khác
    if (updates.code) {
      updates.code = updates.code.toUpperCase();
      const existingVoucher = await Voucher.findOne({ 
        code: updates.code, 
        _id: { $ne: id } // Không tính chính nó
      });
      if (existingVoucher) {
        return res.status(400).json({ success: false, message: "Mã giảm giá này đã tồn tại ở một bài ghi khác" });
      }
    }

    // Chuẩn hóa định dạng ngày tháng nếu Admin cập nhật thời hạn
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    // Tiến hành cập nhật dữ liệu mới vào DB
    const updatedVoucher = await Voucher.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true } // Trả về data mới sau khi sửa và chạy các validate của schema
    );

    if (!updatedVoucher) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá cần cập nhật" });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật cấu hình mã giảm giá thành công",
      data: updatedVoucher
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi cập nhật mã giảm giá", error: error.message });
  }
};

// ==========================================
// 6. ADMIN: XÓA HOÀN TOÀN MÃ GIẢM GIÁ (CMS)
// ==========================================
export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedVoucher = await Voucher.findByIdAndDelete(id);

    if (!deletedVoucher) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá để xóa" });
    }

    return res.status(200).json({
      success: true,
      message: "Đã xóa mã giảm giá thành công khỏi hệ thống"
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi xóa mã giảm giá", error: error.message });
  }
};