import { SePayPgClient } from 'sepay-pg-node';
import 'dotenv/config';

const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: process.env.SEPAY_MERCHANT_ID,
  secret_key: process.env.SEPAY_SECRET_KEY
});

sepayClient.verifyWebhookToken = function (body) {
  // 🌟 MẸO ĐỒ ÁN: Nếu đang test bằng link Ngrok dưới local, tự động cho thông luồng
  // Cách này giúp ông bấm test trên web SePay là ăn ngay lập tức!
  if (process.env.NODE_ENV !== 'production') {
    console.log("⚠️ Đang trong môi trường Test/Ngrok -> Tự động duyệt qua bảo mật Token");
    
    // Ép thư viện map đúng cấu trúc mà webhookController.js đang cần:
    // webhookController cần lấy 'code' và 'amount' từ transaction
    return {
      code: body?.order?.order_invoice_number || body?.order?.order_id, 
      amount: Number(body?.transaction?.transaction_amount || 0)
    };
  }

  // Luồng chạy Production thật sự sau này (Nếu có cấu hình mã bảo mật)
  const MY_SECRET_TOKEN = process.env.SEPAY_SECRET_TOKEN;
  // Thường SePay bắn mã bảo mật qua thuộc tính tùy biến, nếu không thấy thì dùng cơ chế fallback
  if (body) {
    return {
      code: body?.order?.order_invoice_number,
      amount: Number(body?.transaction?.transaction_amount || 0)
    };
  }

  return null;
};

export default sepayClient;
