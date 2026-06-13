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
    const chatQuery = buildChatHistoryQuery(chatIdentity); // tìm lịch sử chat dựa theo userId hoặc sessionId
    const chatHistory = chatQuery ? await ChatHistory.findOne(chatQuery).lean() : null; // lấy lịch sử từ db
    const recentMessages = chatHistory ? chatHistory.messages.slice(-6) : [];
    const orderCode = extractOrderCodeFromMessage(userQuestion); 

    // PHÂN LOẠI INTENT CHAT (Chưa bốc hết sản phẩm để tiết kiệm Token)
    const chatIntent = await detectChatIntent({ message: userQuestion, recentMessages });

    // TỐI ƯU DUNG LƯỢNG DB: Lọc sản phẩm thông minh theo Intent
    let productsForContext = [];
    const productQuery = (chatIntent.query || userQuestion).trim();
    const productMatches = await buildBestProductMatches(productQuery);
    const isFollowUpProductAsk = /\b(xem|cho tôi xem|cho mình xem|show|ảnh|hình|hinh|chi tiết|chi tiet|details|image|photo)\b/i.test(userQuestion);

    if (chatIntent.intent === 'product') {
      if (productMatches && productMatches.length > 0) {
        productsForContext = productMatches.slice(0, 5); 
      } else {
        productsForContext = await Product.find({}, 'name price stock description category brand image').limit(5).lean();
      }
    } else if (chatIntent.intent === 'product-report') {
      productsForContext = await Product.find({}, 'name price stock description category brand').limit(3).lean();
    } else {
      productsForContext = [];
    }
    const wantsOrderInfo = isOrderQuestion(userQuestion);
    const currentUserId = chatIdentity.userId;
    const queryText = userQuestion.toLowerCase();

    // XỬ LÝ Ý ĐỊNH BÁO CÁO SẢN PHẨM (BÁN CHẠY, Ế, ĐẮT, RẺ, HỎI THEO TIỀN)
    if (chatIntent.intent === 'product-report') {
      
      // Trường hợp: Đắt nhất
      if (queryText.includes('đắt nhất') || queryText.includes('giá cao nhất') || queryText.includes('khủng nhất')) {
        const topPrice = await Product.findOne({}).sort({ price: -1 }).lean();
        return res.json({
          content: `Sản phẩm có mức giá cao nhất tại hệ thống hiện tại là **${topPrice.name}** với giá ${topPrice.price.toLocaleString('vi-VN')} VNĐ. Bạn có muốn tham khảo thêm cấu hình không?`,
          action: 'product-results',
          products: [topPrice],
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }

      // Trường hợp: Rẻ nhất
      if (queryText.includes('rẻ nhất') || queryText.includes('giá thấp nhất') || queryText.includes('tiết kiệm nhất')) {
        const lowPrice = await Product.findOne({}).sort({ price: 1 }).lean();
        return res.json({
          content: `Sản phẩm có mức giá rẻ nhất hệ thống là **${lowPrice.name}** hiện đang bán với giá chỉ ${lowPrice.price.toLocaleString('vi-VN')} VNĐ!`,
          action: 'product-results',
          products: [lowPrice],
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }

      // Trường hợp: Bán chạy nhất
      if (queryText.includes('bán chạy') || queryText.includes('hot nhất') || queryText.includes('mua nhiều')) {
        const bestSellers = await Product.find({ sold: { $gt: 0 } }).sort({ sold: -1 }).limit(3).lean();
        return res.json({
          content: `Dưới đây là danh sách những sản phẩm bán chạy nhất tại hệ thống TechShop, được đông đảo người dùng lựa chọn:`,
          action: 'product-results',
          products: bestSellers,
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }

      // Trường hợp: Bán tệ nhất (ế nhất)
      if (queryText.includes('tệ nhất') || queryText.includes('bán ế') || queryText.includes('ít mua nhất') || queryText.includes('chậm nhất')) {
        const worstSellers = await Product.find({}).sort({ sold: 1 }).limit(3).lean();
        return res.json({
          content: `Đây là những sản phẩm đang có số lượng bán ra ít nhất tại cửa hàng hiện tại để bạn tham khảo:`,
          action: 'product-results',
          products: worstSellers,
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }

      // Trường hợp: Hỏi mua theo ngân sách tiền (Xử lý toàn bộ các loại từ lóng củ, chai, tr, k, số lẻ)
      if (chatIntent.extractedBudget) {
        const budgetAmount = Number(chatIntent.extractedBudget);
        if (!isNaN(budgetAmount) && budgetAmount > 0) {
          const matchedBudgetProducts = await Product.find({ price: { $lte: budgetAmount } })
            .sort({ price: -1 })
            .limit(4)
            .lean();

          if (matchedBudgetProducts.length === 0) {
            return res.json({
              content: `Dạ hiện tại TechShop chưa có sản phẩm nào trong phân khúc giá dưới ${budgetAmount.toLocaleString('vi-VN')} VNĐ rồi ạ. Bạn có thể nâng khoảng ngân sách lên một chút được không?`,
              action: 'text',
              sessionId: chatIdentity.sessionId || null,
              userId: chatIdentity.userId || null
            });
          }

          return res.json({
            content: `Với ngân sách khoảng tầm ${budgetAmount.toLocaleString('vi-VN')} VNĐ, TechShop xin tư vấn cho bạn các dòng máy tối ưu và phù hợp nhất dưới đây:`,
            action: 'product-results',
            products: matchedBudgetProducts,
            sessionId: chatIdentity.sessionId || null,
            userId: chatIdentity.userId || null
          });
        }
      }
    }

    // XỬ LÝ Ý ĐỊNH BÁO CÁO HÓA ĐƠN ĐƠN HÀNG
    if (chatIntent.intent === 'order-report') {
      // Hóa đơn đắt nhất hệ thống
      if (queryText.includes('đắt nhất') || queryText.includes('cao nhất')) {
        const maxOrder = await Order.findOne({}).sort({ totalPrice: -1 }).lean();
        return res.json({
          content: `Hóa đơn có giá trị lớn nhất trên hệ thống hiện tại là mã **${maxOrder.orderId}** của khách hàng ${maxOrder.customerName} với tổng số tiền thanh toán là **${maxOrder.totalPrice.toLocaleString('vi-VN')} VNĐ**.`,
          action: 'text',
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }
      // Hóa đơn rẻ nhất hệ thống
      if (queryText.includes('rẻ nhất') || queryText.includes('thấp nhất')) {
        const minOrder = await Order.findOne({}).sort({ totalPrice: 1 }).lean();
        return res.json({
          content: `Hóa đơn có giá trị nhỏ nhất trên hệ thống hiện tại là mã **${minOrder.orderId}** với tổng tiền là **${minOrder.totalPrice.toLocaleString('vi-VN')} VNĐ**.`,
          action: 'text',
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }

      // Khách tìm hóa đơn của riêng họ theo khoảng giá
      if (queryText.includes('của tôi') || queryText.includes('mình')) {
        if (!chatIdentity.userId) {
          return res.json({ 
            content: "Vui lòng đăng nhập tài khoản để hệ thống xác thực và tra cứu hóa đơn cá nhân của bạn nhé!", 
            action: 'text',
            sessionId: chatIdentity.sessionId || null,
            userId: chatIdentity.userId || null
          });
        }

        if (chatIntent.extractedBudget) {
          const targetPrice = Number(chatIntent.extractedBudget);
          const offsetRange = 2000000; 

          const myOrders = await Order.find({
            userId: chatIdentity.userId,
            totalPrice: { $gte: targetPrice - offsetRange, $lte: targetPrice + offsetRange }
          }).lean();

          if (myOrders.length === 0) {
            return res.json({ 
              content: `Tra cứu lịch sử giao dịch của bạn, TechShop không thấy hóa đơn nào có giá trị dao động tầm ${targetPrice.toLocaleString('vi-VN')} VNĐ ạ.`,
              action: 'text',
              sessionId: chatIdentity.sessionId || null,
              userId: chatIdentity.userId || null
            });
          }

          let replyOrders = `Dạ TechShop tìm thấy ${myOrders.length} hóa đơn cá nhân của bạn có giá trị xung quanh khoảng giá bạn yêu cầu:\n`;
          myOrders.forEach(ord => {
            replyOrders += `- Mã đơn **${ord.orderId}**: Trị giá **${ord.totalPrice.toLocaleString('vi-VN')} VNĐ** (Trạng thái đơn: ${ord.status})\n`;
          });
          return res.json({ 
            content: replyOrders, 
            action: 'text',
            sessionId: chatIdentity.sessionId || null,
            userId: chatIdentity.userId || null
          });
        }
      }
    }

    // XỬ LÝ Ý ĐỊNH THỐNG KÊ KHÁCH HÀNG VIP MUA NHIỀU TIỀN NHẤT
    if (chatIntent.intent === 'customer-report') {
      const topCustomerAggregation = await Order.aggregate([
        { $match: { status: 'Đã nhận' } },
        { 
          $group: { 
            _id: '$userId', 
            totalSpent: { $sum: '$totalPrice' }, 
            orderCount: { $sum: 1 }, 
            name: { $first: '$customerName' } 
          } 
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 }
      ]);

      if (topCustomerAggregation.length > 0) {
        const vip = topCustomerAggregation[0];
        return res.json({
          content: `Khách hàng VIP sở hữu tổng chi tiêu lớn nhất hệ thống TechShop hiện tại là anh/chị **${vip.name}** với tổng số tiền đã mua hàng lên đến **${vip.totalSpent.toLocaleString('vi-VN')} VNĐ** (thực hiện mua thành công ${vip.orderCount} đơn hàng).`,
          action: 'text',
          sessionId: chatIdentity.sessionId || null,
          userId: chatIdentity.userId || null
        });
      }
      return res.json({ 
        content: "Dạ hiện tại hệ thống chưa có đủ dữ liệu hóa đơn hoàn thành để thống kê khách hàng VIP ạ.",
        action: 'text',
        sessionId: chatIdentity.sessionId || null,
        userId: chatIdentity.userId || null
      });
    }
    
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

      const systemInstructionConfig = `Bạn là một nhân viên tư vấn bán hàng trực tuyến xuất sắc, thân thiện và am hiểu công nghệ tại cửa hàng "TechShop".
    Nhiệm vụ trọng tâm của bạn là sử dụng ngữ cảnh danh sách sản phẩm được cung cấp bên dưới để trả lời các câu hỏi từ khách hàng một cách ngắn gọn, thuyết phục, tập trung chốt đơn.
    Nếu khách hàng hỏi các thông tin bên ngoài (như thời tiết, tin tức, sự kiện...), bạn hãy sử dụng công cụ tìm kiếm được tích hợp để trả lời chính xác, sau đó khéo léo dẫn dắt họ quay lại sản phẩm của TechShop.

    --- DỮ LIỆU CỬA HÀNG HIỆN TẠI (TỪ DATABASE) ---
    ${productContext}
    ---------------------------------
    --- DỮ LIỆU TÀI LIỆU BỔ SUNG (RAG) ---
    ${matchedKnowledgeContext || 'Chưa có tài liệu bổ sung phù hợp.'}
    ---------------------------------`;
    const userPrompt = `LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
    ${recentMessages || 'Chưa có lịch sử hội thoại trước đó.'}

    Khách hàng nhắn: "${userQuestion}"
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
          tools: [{ googleSearch: {} }],
          systemInstruction: systemInstructionConfig
        });
        geminiResult = await model.generateContent(userPrompt);
        break;
      } catch (geminiError) {
        lastGeminiError = geminiError;
        const statusCode = geminiError?.status || geminiError?.response?.status;
        const errorString = String(geminiError);
        if (
          statusCode === 404 || statusCode === 429 || statusCode === 503 ||
          errorString.includes('429') || errorString.includes('Too Many Requests')
        ) {
          console.warn(`Model ${modelName} lỗi hạn mức, đang chuyển model...`);
          continue;
        }
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
