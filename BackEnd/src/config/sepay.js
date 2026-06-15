import { SePayPgClient } from 'sepay-pg-node';
import 'dotenv/config';

const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: process.env.SEPAY_MERCHANT_ID,
  secret_key: process.env.SEPAY_SECRET_KEY
});

// 🔒 Thay đổi tham số từ (body) thành (req) để lấy headers xác thực
sepayClient.verifyWebhookToken = function (req) {
  const body = req.body;
  
  // 🔐 BẮT BUỘC AUTH: Đọc mã bảo mật từ Header do SePay gửi sang
  const authHeader = req.headers['authorization'];
  const MY_SECRET_KEY = process.env.SEPAY_SECRET_KEY; // Chuỗi token cấu hình trong file .env

  // 1. Kiểm tra xem request có gửi kèm Header Authorization dạng Bearer không
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Thất bại: Không tìm thấy Authorization Header hợp lệ từ SePay');
    return null;
  }

  // 2. Tách chuỗi token thực tế nằm sau chữ 'Bearer '
  const tokenReceived = authHeader.split(' ')[1];

  // 3. So khớp token nhận được với cấu hình hệ thống
  if (tokenReceived !== MY_SECRET_KEY) {
    console.error('❌ Thất bại: Mã bảo mật Webhook (Secret Key) không chính xác!');
    return null;
  }

  console.log('✅ Xác thực Webhook SePay thành công!');

  // 4. Nếu khớp mã, bóc tách dữ liệu trả về cho controller xử lý đơn hàng
  if (body) {
    return {
      code: body?.order?.order_invoice_number || body?.order?.order_id,
      amount: Number(body?.transaction?.transaction_amount || 0)
    };
  }

  return null;
};

export default sepayClient;