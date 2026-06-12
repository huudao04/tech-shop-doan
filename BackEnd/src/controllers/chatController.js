import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Knowledge from '../models/Knowledge.js';
import ChatHistory from '../models/ChatHistory.js';
import { genAI, GEMINI_MODEL_CANDIDATES } from '../config/gemini.js';
import {
  resolveChatIdentity,
  buildChatHistoryQuery,
  getEmbedding,
  cosineSimilarity,
  buildProductImagePath,
  extractOrderCodeFromMessage,
  isOrderQuestion,
  buildBestProductMatches,
  detectChatIntent,
  buildOrderSummary,
  persistChatExchange,
  getOptionalUserId
} from '../ultils/chatHelpers.js';

export const handleChat = async (req, res) => {
  const { message } = req.body;
  const chatIdentity = resolveChatIdentity(req);
  const userQuestion = String(message || '').trim();

  if (!userQuestion) {
    return res.status(400).json({ content: 'Vui lòng nhập nội dung cần hỏi.' });
  }

  try {
    const questionEmbedding = await getEmbedding(userQuestion, 'query');
    const products = await Product.find({}, 'name price stock description category brand image');
    const chatQuery = buildChatHistoryQuery(chatIdentity);
    const chatHistory = chatQuery ? await ChatHistory.findOne(chatQuery).lean() : null;

    const wantsOrderInfo = isOrderQuestion(userQuestion);
    const currentUserId = chatIdentity.userId;
    const orderCode = extractOrderCodeFromMessage(userQuestion);
    const recentMessages = [...(chatHistory?.messages || []), ...(Array.isArray(req.body.history) ? req.body.history : [])]
      .filter((item) => item && typeof item.content === 'string')
      .slice(-8)
      .map((item) => `${item.role === 'assistant' || item.role === 'ai' ? 'Trợ lý' : 'Khách hàng'}: ${item.content}`)
      .join('\n');

    const chatIntent = await detectChatIntent({ message: userQuestion, recentMessages, products });
    const productQuery = (chatIntent.query || userQuestion).trim();
    const productMatches = await buildBestProductMatches(productQuery);
    const isFollowUpProductAsk = /\b(xem|cho tôi xem|cho mình xem|show|ảnh|hình|hinh|chi tiết|chi tiet|details|image|photo)\b/i.test(userQuestion);

    if (wantsOrderInfo || chatIntent.intent === 'order') {
      if (!currentUserId) {
        return res.json({
          content: 'Bạn cần đăng nhập để TechShop tra cứu lịch sử đơn hàng cá nhân. Sau khi đăng nhập, bạn có thể xem toàn bộ đơn tại màn quản lý đơn hàng.',
          action: 'order-login-required',
          targetUrl: '/login',
          sessionId: chatIdentity.sessionId || null,
          userId: null
        });
      }

      const orderQuery = { userId: currentUserId };
      if (orderCode) orderQuery.orderId = orderCode;

      const orders = await Order.find(orderQuery).sort({ createdAt: -1 }).limit(3).lean();
      if (orders.length === 0) {
        return res.json({
          content: 'TechShop chưa tìm thấy đơn hàng phù hợp trong tài khoản của bạn. Bạn có thể mở màn quản lý đơn hàng để kiểm tra toàn bộ lịch sử mua hàng.',
          action: 'order-empty',
          targetUrl: '/my-orders',
          orders: [],
          sessionId: chatIdentity.sessionId || null,
          userId: currentUserId
        });
      }

      const orderSummaries = orders.map(buildOrderSummary);
      return res.json({
        content: `TechShop tìm thấy ${orderSummaries.length} đơn hàng của bạn. Bạn có thể bấm vào nút bên dưới để mở màn quản lý đơn hàng và xem chi tiết từng đơn.`,
        action: 'order-results',
        targetUrl: orderSummaries[0].detailUrl || '/my-orders',
        orders: orderSummaries,
        sessionId: chatIdentity.sessionId || null,
        userId: currentUserId
      });
    }

    if ((chatIntent.intent === 'product' || isFollowUpProductAsk) && productMatches.length > 0) {
      const productResults = productMatches.map((product) => ({
        _id: product._id?.toString?.() || String(product._id),
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description,
        category: product.category,
        brand: product.brand,
        image: buildProductImagePath(product.image)
      }));

      return res.json({
        content: `TechShop đã tìm thấy ${productResults.length} sản phẩm phù hợp. Bạn có thể bấm để xem chi tiết từng sản phẩm.`,
        action: 'product-results',
        targetUrl: `/product/${productResults[0]._id}`,
        products: productResults,
        sessionId: chatIdentity.sessionId || null,
        userId: currentUserId || null
      });
    }

    let productContext = 'Dưới đây là danh sách toàn bộ sản phẩm công nghệ đang có sẵn trong cửa hàng TechShop của chúng ta:\n';
    products.forEach((p, index) => {
      productContext += `${index + 1}. Tên: ${p.name} | Giá: ${p.price.toLocaleString()} VNĐ | Hãng: ${p.brand} | Loại: ${p.category} | Số lượng tồn kho: ${p.stock} chiếc | Mô tả: ${p.description || 'Không có'}\n`;
    });

    const knowledgeDocuments = await Knowledge.find({}).lean();
    const matchedKnowledgeContext = knowledgeDocuments
      .map((document) => ({
        fileName: document.fileName || 'Tài liệu không rõ tên',
        content: document.content || '',
        score: cosineSimilarity(questionEmbedding, document.embedding || [])
      }))
      .filter((document) => document.score > 0.45)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4)
      .map((document) => `[${document.fileName}] (${document.score.toFixed(3)}): ${document.content}`)
      .join('\n\n');

    const systemInstruction = `Bạn là một nhân viên tư vấn bán hàng trực tuyến xuất sắc, thân thiện và am hiểu công nghệ tại cửa hàng "TechShop".
    Nhiệm vụ trọng tâm của bạn là sử dụng ngữ cảnh danh sách sản phẩm được cung cấp bên dưới để trả lời các câu hỏi từ khách hàng một cách ngắn gọn, thuyết phục, tập trung chốt đơn.
    --- DỮ LIỆU CỬA HÀNG HIỆN TẠI (TỪ DATABASE) ---
    ${productContext}
    ---------------------------------
    --- DỮ LIỆU TÀI LIỆU BỔ SUNG (RAG) ---
    ${matchedKnowledgeContext || 'Chưa có tài liệu bổ sung phù hợp.'}
    ---------------------------------
    LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
    ${recentMessages || 'Chưa có lịch sử hội thoại trước đó.'}
    Khách hàng nhắn: "${message}"
    Hãy đưa ra câu trả lời tư vấn ngắn gọn, chuyên nghiệp và tối ưu nhất:`;

    if (!genAI) {
      return res.status(500).json({ content: 'Chưa cấu hình GEMINI_API_KEY cho chatbot.' });
    }

    let geminiResult = null;
    let lastGeminiError = null;

    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          tools: [{ googleSearch: {} }] 
        });
        geminiResult = await model.generateContent(systemInstruction);
        break;
      } catch (geminiError) {
        lastGeminiError = geminiError;
        if (geminiError?.status === 404 || geminiError?.status === 429 || geminiError?.status === 503) continue;
        throw geminiError;
      }
    }

    if (!geminiResult) {
      throw lastGeminiError || new Error('Không có model Gemini khả dụng.');
    }

    const content = geminiResult?.response?.text?.() || 'Xin lỗi, TechShop chưa lấy được phản hồi từ hệ thống AI.';
    await persistChatExchange({
      ...chatIdentity,
      userMessage: userQuestion,
      assistantMessage: content
    });

    return res.json({
      content,
      sessionId: chatIdentity.sessionId || null,
      userId: chatIdentity.userId || null,
      action: 'text'
    });
  } catch (error) {
    console.error('Lỗi AI:', error?.message || error);

    if (error?.status === 429) {
      return res.status(429).json({ content: 'Gemini đang vượt giới hạn quota. Vui lòng thử lại sau vài phút hoặc nâng gói API key.' });
    }

    if (error?.status === 404 || error?.status === 429 || error?.status === 503) {
      return res.status(503).json({ content: 'Model Gemini hiện không khả dụng. Vui lòng kiểm tra cấu hình model trong backend.' });
    }

    return res.status(500).json({ content: 'Chatbot đang bảo trì, vui lòng quay lại sau!' });
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    const userId = getOptionalUserId(req);
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;
    const query = userId ? { userId } : (sessionId ? { sessionId } : null);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Cần cung cấp sessionId hoặc token đăng nhập để xóa lịch sử chat.'
      });
    }

    const result = await ChatHistory.deleteMany(query);
    return res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể xóa lịch sử chat' });
  }
};
