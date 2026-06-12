import mongoose from 'mongoose';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { getIo } from '../services/socket.js';

const emitNotification = (room, payload) => {
  const io = getIo();
  if (io) io.to(room).emit('new_notification', payload);
};

export const addProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(req.params.productId),
      userId: req.user.id,
      name: user.name,
      rating: Number(rating),
      comment
    });
    await newReview.save();
    return res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể gửi đánh giá' });
  }
};

export const updateCustomerReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findOne({ _id: req.params.id, userId: req.user.id });
    if (!review) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa hoặc đánh giá không tồn tại!' });
    }

    review.rating = Number(rating);
    review.comment = comment;
    await review.save();

    return res.json({ success: true, message: 'Cập nhật đánh giá thành công!', review });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi sửa đánh giá' });
  }
};

export const deleteCustomerReview = async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!review) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa hoặc đánh giá không tồn tại!' });
    }
    return res.json({ success: true, message: 'Xóa đánh giá thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xóa đánh giá' });
  }
};

export const replyReview = async (req, res) => {
  try {
    const { comment } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Đánh giá gốc không tồn tại' });

    const discussionItem = {
      userId: user._id,
      name: user.name,
      role: user.role,
      comment,
      createdAt: new Date()
    };

    review.discussions = review.discussions || [];
    review.discussions.push(discussionItem);
    await review.save();

    if (user.role === 'admin') {
      emitNotification(review.userId.toString(), {
        title: 'Phản hồi mới từ Admin 💬',
        message: 'Quản trị viên đã trả lời đánh giá của bạn tại sản phẩm.',
        type: 'discussion'
      });
      await Notification.create({
        userId: review.userId,
        title: 'Phản hồi mới từ Admin 💬',
        message: 'Quản trị viên đã trả lời đánh giá của bạn tại sản phẩm.',
        type: 'discussion',
        meta: { reviewId: review._id, productId: review.productId }
      });
    } else {
      emitNotification('admin', {
        title: 'Thảo luận mới từ Khách 💬',
        message: `Khách hàng ${user.name} vừa phản hồi trong chuỗi thảo luận đánh giá.`,
        type: 'discussion'
      });
      await Notification.create({
        title: 'Thảo luận mới từ Khách 💬',
        message: `Khách hàng ${user.name} vừa phản hồi trong chuỗi thảo luận đánh giá.`,
        type: 'discussion',
        meta: { reviewId: review._id, productId: review.productId, fromUserId: user._id }
      });
    }

    return res.json({ success: true, message: 'Đã gửi phản hồi trao đổi!', review });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi thảo luận' });
  }
};

export const getAdminRatings = async (req, res) => {
  try {
    const ratings = await mongoose.connection.db
      .collection('ratings')
      .find({})
      .sort({ value: -1 })
      .toArray();
    return res.json({ success: true, data: ratings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi không thể đọc dữ liệu số sao!' });
  }
};

export const getAdminReviews = async (req, res) => {
  try {
    const { searchCustomer, productId, rating, date } = req.query;
    const query = {};

    if (searchCustomer) query.name = { $regex: searchCustomer, $options: 'i' };
    if (productId) query.productId = productId;
    if (rating) query.rating = parseInt(rating, 10);
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const reviews = await Review.find(query)
      .populate('productId', 'name image')
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tải danh sách đánh giá!' });
  }
};

export const createAdminReview = async (req, res) => {
  try {
    const { productId, name, rating, comment, reply } = req.body;
    const newReview = new Review({
      productId: new mongoose.Types.ObjectId(productId),
      name,
      rating: Number(rating),
      comment,
      reply: reply || ''
    });
    await newReview.save();
    const populatedReview = await Review.findById(newReview._id).populate('productId', 'name image');
    return res.status(201).json({ success: true, message: 'Thêm đánh giá thành công!', review: populatedReview });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể thêm đánh giá' });
  }
};

export const updateAdminReview = async (req, res) => {
  try {
    const { productId, name, rating, comment } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { productId: new mongoose.Types.ObjectId(productId), name, rating: Number(rating), comment },
      { returnDocument: 'after' }
    ).populate('productId', 'name image');

    if (!updatedReview) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    return res.json({ success: true, message: 'Cập nhật thành công!', review: updatedReview });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật' });
  }
};

export const replyAdminReview = async (req, res) => {
  try {
    const { reply } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { reply },
      { returnDocument: 'after' }
    ).populate('productId', 'name image');
    return res.json({ success: true, message: 'Gửi phản hồi thành công!', review: updatedReview });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể gửi phản hồi' });
  }
};

export const deleteAdminReview = async (req, res) => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    if (!deletedReview) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi' });
    return res.json({ success: true, message: 'Xóa đánh giá thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể thực hiện' });
  }
};
