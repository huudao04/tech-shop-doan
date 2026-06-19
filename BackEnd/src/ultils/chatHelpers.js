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

  // 1. Ưu tiên tìm kiếm chính xác nguyên cụm (như code cũ của bạn)
  const escapedQuery = normalizedMessage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactMatches = await Product.find({ name: { $regex: `^${escapedQuery}$`, $options: 'i' } })
    .select('_id name price stock description category brand image')
    .limit(3)
    .lean();

  if (exactMatches.length > 0) return exactMatches;

  // 2. Lọc bỏ các từ nối tiếng Việt thường gặp khi chat so sánh
  const stopWords = ['so sánh', 'và', 'hoặc', 'với', 'giữa', 'khác gì', 'hơn', 'kém'];
  let cleanQuery = normalizedMessage.toLowerCase();
  stopWords.forEach(word => {
    // Xóa các từ nối để chỉ giữ lại tên sản phẩm
    cleanQuery = cleanQuery.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  });

  // 3. Tách chuỗi thành mảng các từ khóa (VD: ["iphone", "15", "samsung", "s24"])
  const keywords = cleanQuery.split(/,|\s+/).filter(k => k.trim().length > 1);

  if (keywords.length === 0) {
     return Product.find({ name: { $regex: new RegExp(escapedQuery, 'i') } })
      .select('_id name price stock description category brand image')
      .limit(3)
      .lean();
  }

  // 4. Xây dựng mảng Regex cho từng từ khóa riêng lẻ
  const regexArray = keywords.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  });

  // 5. Tìm bằng toán tử $or: Chỉ cần tên sản phẩm chứa 1 trong các từ khóa là lấy
  return Product.find({ 
      $or: regexArray.map(regex => ({ name: { $regex: regex } }))
    })
    .select('_id name price stock description category brand image')
    .limit(8) // Tăng limit để lấy đủ dải sản phẩm cho 2 hãng
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

export const detectChatIntent = async ({ message, recentMessages = [], products = [] }) => {
  if (!genAI) return { intent: 'other', query: message, confidence: 0 };

  const referencedProductName = recentMessages
    .filter(m => m.role === 'assistant' && m.productContext?.name)
    .pop()?.productContext?.name || '';

  // Bổ sung các cấu trúc intent báo cáo và ép AI quy đổi tiền tệ lóng sang số dạng chuỗi
  const intentPrompt = `
    Bạn là một chuyên gia phân loại ý định người dùng cho chatbot cửa hàng công nghệ TechShop.
    Hãy phân tích câu tin nhắn mới nhất của người dùng dưới đây và trả về một cấu trúc JSON duy nhất.

    Tin nhắn mới nhất: "${message}"

    Các loại Intent hợp lệ bạn bắt buộc phải phân loại:
    1. "product": Hỏi mua, tìm kiếm thông tin tính năng, thông số sản phẩm cụ thể.
    2. "order": Hỏi về trạng thái đơn hàng, hủy đơn, kiểm tra đơn hàng, xem giỏ hàng.
    3. "product-report": Người dùng đang hỏi dạng thống kê/so sánh về sản phẩm như:
       - Bán chạy nhất, hot nhất, mua nhiều nhất.
       - Bán ế nhất, ít ai mua, tệ nhất.
       - Đắt nhất, cao nhất, rẻ nhất, thấp nhất.
       - Hỏi lọc sản phẩm theo ngân sách tiền (ví dụ: "tầm 10 triệu mua gì", "có máy nào 10 củ không", "máy tính dưới 20tr500k", "máy nào tầm 15 chai").
    4. "order-report": Người dùng hỏi thống kê về hóa đơn/đơn hàng (Đơn đắt nhất, đơn rẻ nhất, tìm đơn hàng của TÔI theo khoảng giá tiền nào đó).
    5. "customer-report": Hỏi về thông tin khách hàng mua nhiều nhất, khách VIP nhất hệ thống.
    6. "other": Chào hỏi, tán gẫu, hỏi thời tiết, hoặc các câu hỏi chung chung khác ngoài các loại trên.

    Đặc biệt lưu ý khi phân tích ngân sách tiền mặt của người dùng:
    - Nếu tin nhắn có nhắc đến giá tiền, phân khúc giá hoặc ngân sách, bạn phải tự động tính toán quy đổi các thuật ngữ lóng tiếng Việt (như: tr = triệu, củ = triệu, chai = triệu, k = nghìn, đồng = 1) về một con số dạng chuỗi CHỈ CHỨA SỐ (ví dụ: "10 triệu", "10tr", "10 củ", "10 chai" -> "10000000"; "10k" -> "10000"; "20 triệu 5 nghìn", "20tr500k", "20.5 củ" -> "20500000"). Nhét con số này vào trường "extractedBudget". Nếu không có giá tiền, hãy để rỗng "".

    Trả về định dạng JSON nghiêm ngặt sau, không viết thêm bất kỳ chữ nào khác ngoài JSON:
    {
      "intent": "product" | "order" | "product-report" | "order-report" | "customer-report" | "other",
      "query": "từ khóa tìm kiếm chính hoặc tên sản phẩm",
      "extractedBudget": "chuỗi_chỉ_chứa_số_sau_khi_quy_đổi_hoặc_rỗng",
      "confidence": 0.95
    }
  `;

  let lastError = null;
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(intentPrompt);
      const text = result?.response?.text?.() || '';
      
      // Hàm helper parse của bạn có sẵn
      const parsed = parseAiJsonResponse ? parseAiJsonResponse(text) : JSON.parse(text.replace(/```json|```/g, '').trim());

      if (parsed && typeof parsed === 'object') {
        return {
          intent: parsed.intent || 'other',
          query: parsed.query || message,
          extractedBudget: parsed.extractedBudget || '',
          confidence: Number(parsed.confidence) || 0
        };
      }
    } catch (error) {
      lastError = error;
      const statusCode = error?.status || error?.response?.status;
      const errorString = String(error);
      if (statusCode === 429 || statusCode === 503 || errorString.includes('429')) {
        continue;
      }
      break;
    }
  }

  console.error('Lỗi phân loại intent chatbot:', lastError?.message || lastError);
  return { intent: 'other', query: message, extractedBudget: '', confidence: 0 };
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
