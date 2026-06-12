import mongoose from "mongoose";
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String },
    brand: { type: String },
    stock: { type: Number, default: 0 },
    image: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    sold: { type: Number, default: 0 }
    },{ timestamps: true });

export default mongoose.model('Product', productSchema);