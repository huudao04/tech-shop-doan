import mongoose from "mongoose";
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    shippingAddress: { type: String, required: true },
    provinceFilter: { type: String, default: "Khác" },
    paymentMethod: { type: String, enum: ['COD', 'BANK_TRANSFER'], required: true },
    paymentStatus: { type: String, enum: ['Chờ thanh toán', 'Đã thanh toán', 'Thanh toán thất bại'], default: 'Chờ thanh toán' },
    status: { 
        type: String, 
        enum: ['Chờ xác nhận', 'Đang đóng gói', 'Đang giao', 'Đã nhận', 'Hủy đơn hàng'], 
        default: 'Chờ xác nhận' 
    },
    items: [
        {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true }
        }
    ],
    totalPrice: { type: Number, required: true },
    qrCodeUrl: { type: String },
    paymentUrl: { type: String },
    stockReserved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
    });
export default mongoose.model('Order', orderSchema);