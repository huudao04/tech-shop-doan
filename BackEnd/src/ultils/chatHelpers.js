import 'dotenv/config';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import Product from '../models/Product.js';
import ChatHistory from '../models/ChatHistory.js';
import { genAI, GEMINI_MODEL_CANDIDATES, EMBEDDING_MODEL_CANDIDATES } from '../config/gemini.js';
import { makeVietnameseRegex } from './helpers.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const getOptionalUserId = (req) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token || !JWT_SECRET) return null;

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    return verified.id || null;
  } catch {
    return null;
  }
};

export const resolveChatIdentity = (req) => {
  const userId = getOptionalUserId(req);
  const sessionId = req.body?.sessionId || req.query?.sessionId || null;

  if (userId) {
    return { userId, sessionId: sessionId || null };
  }

  return { userId: null, sessionId: sessionId || randomUUID() };
};

export const buildChatHistoryQuery = ({ userId, sessionId }) => {
  if (userId) return { userId };
  if (sessionId) return { sessionId };
  return null;
};

const prepareEmbeddingContent = (text, kind = 'query', modelName = EMBEDDING_MODEL_CANDIDATES[0]) => {
  const content = String(text || '').trim();

  if (modelName === 'gemini-embedding-2') {
    if (kind === 'document') {
      return `title: none | text: ${content}`;
    }
    return `task: search result | query: ${content}`;
  }

  return content;
};

export const getEmbedding = async (text, kind = 'query') => {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  }

  let lastError = null;

  for (const modelName of EMBEDDING_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const embeddingInput = prepareEmbeddingContent(text, kind, modelName);
      const result = await model.embedContent(embeddingInput);
      return result?.embedding?.values || [];
    } catch (error) {
      lastError = error;
      if (error?.status === 404) continue;
      throw error;
    }
  }

  throw new Error(
    `Embedding model not available. Set process.env.EMBEDDING_MODEL to a supported Gemini embedding model. Last error: ${lastError?.message || lastError}`
  );
};

export const cosineSimilarity = (vecA = [], vecB = []) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  const length = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index += 1) {
    const valueA = Number(vecA[index]) || 0;
    const valueB = Number(vecB[index]) || 0;
    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (!magnitudeA || !magnitudeB) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

export const buildProductImagePath = (image) => {
  if (Array.isArray(image)) {
    const firstImage = image[0] || '';
    if (!firstImage) return '';
    if (firstImage.startsWith('http')) return firstImage;
    if (firstImage.startsWith('/')) return firstImage;
    return `/images/${firstImage}`;
  }

  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/')) return image;
  return `/images/${image}`;
};

export const extractOrderCodeFromMessage = (message) => {
  const orderCodeMatch = message.match(/DH\d{6}/i);
  return orderCodeMatch ? orderCodeMatch[0].toUpperCase() : null;
};

const ORDER_QUESTION_KEYWORDS = [
  'đơn hàng', 'don hang', 'mã đơn', 'ma don', 'tra cứu', 'truy vấn',
  'kiểm tra', 'kiem tra', 'tình trạng đơn', 'đơn của tôi', 'đơn', 'don'
];

export const isOrderQuestion = (message) => {
  const text = String(message || '').trim();
  if (!text) return false;
  if (extractOrderCodeFromMessage(text)) return true;
  return ORDER_QUESTION_KEYWORDS.some((keyword) => makeVietnameseRegex(keyword).test(text));
};

export const buildBestProductMatches = async (message) => {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return [];

  const escapedQuery = normalizedMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const productNameRegex = new RegExp(escapedQuery, 'i');

  const exactMatches = await Product.find({ name: { $regex: `^${escapedQuery}$`, $options: 'i' } })
    .select('_id name price stock description category brand image')
    .limit(3)
    .lean();

  if (exactMatches.length > 0) return exactMatches;

  return Product.find({ name: { $regex: productNameRegex } })
    .select('_id name price stock description category brand image')
    .limit(3)
    .lean();
};

const findReferencedProductName = ({ currentMessage = '', recentMessages = '', products = [] }) => {
  const combinedText = `${recentMessages}\n${currentMessage}`.toLowerCase();
  let bestMatch = '';
  let bestIndex = -1;

  for (const product of products) {
    const productName = String(product.name || '').trim();
    if (!productName) continue;

    const lowerName = productName.toLowerCase();
    const index = combinedText.lastIndexOf(lowerName);
    if (index >= 0 && index >= bestIndex) {
      bestIndex = index;
      bestMatch = productName;
    }
  }

  return bestMatch;
};

const parseAiJsonResponse = (text) => {
  if (!text || typeof text !== 'string') return null;

  const trimmedText = text.trim();
  const jsonMatch = trimmedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
};

export const detectChatIntent = async ({ message, recentMessages, products }) => {
  if (!genAI) {
    return { intent: 'other', query: message, confidence: 0 };
  }

  const referencedProductName = findReferencedProductName({
    currentMessage: message,
    recentMessages,
    products
  });

  const productNames = products
    .slice(0, 25)
    .map((product) => `- ${product.name}`)
    .join('\n');

  const intentPrompt = `Bạn là bộ phân loại ý định cho chatbot bán hàng TechShop.
Phân tích hội thoại và chỉ trả về JSON hợp lệ theo mẫu:
{"intent":"product|order|other","query":"chuỗi tìm kiếm ngắn gọn hoặc rỗng","confidence":0.0}

Quy tắc:
- intent = product nếu người dùng muốn xem, hỏi, so sánh, tìm, mở, hoặc xem ảnh/hình của sản phẩm.
- intent = order nếu người dùng hỏi đơn hàng, vận chuyển, trạng thái đơn, mã đơn.
- Nếu người dùng nói "cái đó", "nó", "sản phẩm này", "cho tôi xem ảnh", "xem hình", hãy suy luận từ ngữ cảnh hội thoại gần nhất.
- Nếu đã xác định được sản phẩm được nhắc gần nhất, hãy dùng đúng tên đó làm query.
- query nên là tên sản phẩm hoặc cụm từ tìm kiếm ngắn gọn nhất có thể, ưu tiên tên sản phẩm nếu xác định được.
- Không được thêm giải thích ngoài JSON.

Danh sách sản phẩm đang có:
${productNames || '- (trống)'}

Sản phẩm được nhắc gần nhất trong hội thoại, nếu có:
${referencedProductName || '- (không xác định)'}

Hội thoại gần đây:
${recentMessages || '- (không có)'}

Tin nhắn hiện tại:
${message}`;

  let lastError = null;
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
      })
      const result = await model.generateContent(intentPrompt);
      const text = result?.response?.text?.() || '';
      const parsed = parseAiJsonResponse(text);

      if (parsed && typeof parsed === 'object') {
        const intent = ['product', 'order', 'other'].includes(parsed.intent) ? parsed.intent : 'other';
        const query = typeof parsed.query === 'string' ? parsed.query.trim() : '';

        return {
          intent,
          query: query || referencedProductName || message,
          confidence: Number(parsed.confidence) || 0
        };
      }

      return { intent: 'other', query: referencedProductName || message, confidence: 0 };
    } catch (error) {
      lastError = error;
      if (error?.status === 404 || error?.status === 429 || error?.status === 503) continue;
      break;
    }
  }

  console.error('Lỗi phân loại intent chatbot:', lastError?.message || lastError);
  return { intent: 'other', query: referencedProductName || message, confidence: 0 };
};

export const buildOrderSummary = (order) => ({
  _id: order._id?.toString?.() || String(order._id),
  orderId: order.orderId,
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  totalPrice: order.totalPrice,
  createdAt: order.createdAt,
  itemCount: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0,
  detailUrl: `/my-orders?search=${encodeURIComponent(order.orderId)}`
});

export const persistChatExchange = async ({ userId, sessionId, userMessage, assistantMessage }) => {
  const query = buildChatHistoryQuery({ userId, sessionId });
  if (!query) return null;

  const update = {
    $setOnInsert: {
      ...(userId ? { userId } : {}),
      ...(sessionId ? { sessionId } : {})
    },
    $push: {
      messages: {
        $each: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantMessage }
        ]
      }
    }
  };

  return ChatHistory.findOneAndUpdate(query, update, {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true
  });
};
