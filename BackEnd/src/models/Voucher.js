import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discountValue: { type: Number, required: true },
  minOrderValue: { type: Number, default: 0 },
  usageLimit: { type: Number, required: true },
  usedCount: { type: Number, default: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  specificUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  usedByUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// --- ĐẢM BẢO CÓ 2 DÒNG NÀY Ở CUỐI FILE ---
const Voucher = mongoose.model('Voucher', voucherSchema);
export default Voucher;