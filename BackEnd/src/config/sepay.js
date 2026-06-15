import { SePayPgClient } from 'sepay-pg-node';
import 'dotenv/config';

const sepayClient = new SePayPgClient({
  env: 'live',
  merchant_id: process.env.SEPAY_MERCHANT_ID,
  secret_key: process.env.SEPAY_SECRET_KEY
});

// Ghi đè hàm xác thực đồng bộ bằng Chuỗi Tĩnh (TechshopToken)
sepayClient.verifyWebhookToken = function (req) {
  const body = req.body;
  
  // 1. Lấy Token từ Header Authorization
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const EXPECTED_TOKEN = process.env.SEPAY_SECRET_TOKEN || 'TechshopToken';

  // MẸO TEST: Nếu bấm nút Test trên SePay (không có authHeader) nhưng đang chạy qua Ngrok/Local hoặc Render để thử kết nối
  if (!authHeader) {
    console.log("📡 Nhận request Test IPN từ giao diện SePay (Bypass qua check Header để test thông mạch)");
    if (body) {
      return {
        code: body?.order?.order_invoice_number || body?.order?.order_id,
        amount: Number(body?.transaction?.transaction_amount || 0)
      };
    }
    return null;
  }

  // 2. Nếu có authHeader (Luồng chạy thật khi có tiền về), tiến hành kiểm tra bảo mật nghiêm ngặt
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    console.error('❌ Thất bại: Authorization Header không đúng định dạng Bearer');
    return null;
  }

  const tokenReceived = authHeader.split(' ')[1]?.trim();

  // 3. So khớp chuỗi tĩnh "TechshopToken"
  if (tokenReceived !== EXPECTED_TOKEN) {
    console.error(`❌ Thất bại: Mã bảo mật không khớp! Nhận được: "${tokenReceived}"`);
    return null;
  }

  console.log('✅ Xác thực Webhook bằng Secret Key thành công!');

  // 4. Trả về đúng cấu trúc Object cho webhookController bốc tách dữ liệu
  if (body) {
    return {
      code: body?.order?.order_invoice_number || body?.order?.order_id,
      amount: Number(body?.transaction?.transaction_amount || 0)
    };
  }

  return null;
};

export default sepayClient;