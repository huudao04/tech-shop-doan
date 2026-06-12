import mongoose from "mongoose";
const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      image: { type: String, default: '' },
      brand: { type: String, default: '' },
      category: { type: String, default: '' },
      quantity: { type: Number, required: true, min: 1, default: 1 }
    }
  ]
  }, { timestamps: true });
export default mongoose.model('Cart', cartSchema);