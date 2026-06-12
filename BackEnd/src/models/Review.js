import mongoose from "mongoose";
const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    reply: { type: String, default: '' }, 
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
export default mongoose.model('Review', reviewSchema);