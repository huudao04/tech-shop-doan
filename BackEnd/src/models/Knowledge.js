import mongoose from "mongoose";
const knowledgeSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('Knowledge', knowledgeSchema);