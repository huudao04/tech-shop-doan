import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    costPrice: { type: Number, required: true, default: 0 },
    pricingMethod: { 
        type: String, 
        enum: ['manual', 'auto_5', 'auto_10', 'auto_15', 'auto_20', 'auto_25', 'auto_30'], 
        default: 'manual' 
    },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String },
    brand: { type: String },
    stock: { type: Number, default: 0 },
    image: { type: [String], default: [] },
    imageNamesPlaceholder: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'draft'], default: 'active' },
    createdAt: { type: Date, default: Date.now },
    sold: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);