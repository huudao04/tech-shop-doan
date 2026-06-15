import { SePayPgClient } from 'sepay-pg-node';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: process.env.SEPAY_MERCHANT_ID,
  secret_key: process.env.SEPAY_SECRET_KEY
});

// Ghi đè hàm để tự verify JWT theo logic của ông
sepayClient.verifyWebhookToken = function (req) {
  const body = req.body;
  
  // 1. Lấy Token JWT từ Header Authorization
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    console.error('❌ Thất bại: Không tìm thấy JWT Token trong Authorization Header');
    return null;
  }

  const jwtToken = authHeader.split(' ')[1]?.trim();

  try {
    // 2. Tiến hành verify Token JWT bằng Secret Key mà ông dùng để tạo ra cái JWT đó
    // (Ông kiểm tra xem lúc tạo JWT ông dùng JWT_SECRET hay SEPAY_SECRET_TOKEN nhé, ở đây tôi ví dụ là JWT_SECRET)
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
    
    console.log('✅ Xác thực JWT thành công! Dữ liệu trong token:', decoded);
    
    // Nếu ông có lưu thông tin gì trong JWT để đối chiếu (ví dụ: { role: 'sepay' }), ông có thể check ở đây:
    // if (decoded.role !== 'sepay') return null;

  } catch (error) {
    console.error('❌ Thất bại: JWT Token không hợp lệ hoặc đã hết hạn!', error.message);
    return null;
  }

  // 3. Nếu verify JWT thành công, bóc tách data trả về cho webhookController xử lý đơn hàng
  if (body) {
    return {
      code: body?.order?.order_invoice_number || body?.order?.order_id,
      amount: Number(body?.transaction?.transaction_amount || 0)
    };
  }

  return null;
};

export default sepayClient;