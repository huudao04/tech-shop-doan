import mongoose from "mongoose";
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String }
    });
export default mongoose.model('Category', categorySchema);