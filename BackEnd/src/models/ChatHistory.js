import mongoose from "mongoose";
const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: String },
  messages: { type: [chatMessageSchema], default: [] }
}, { timestamps: true });

chatHistorySchema.index({ userId: 1 }, { sparse: true });
chatHistorySchema.index({ sessionId: 1 }, { sparse: true });

export default mongoose.model('ChatHistory', chatHistorySchema);