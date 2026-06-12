import mongoose from "mongoose";
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'general' },
    isRead: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
    });
export default mongoose.model('Notification', notificationSchema);