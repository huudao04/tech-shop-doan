import transporter from '../config/mailer.js'; 
/**
 * Gửi email xác nhận đặt đơn hàng thành công
 * @param {string} toEmail - Email người nhận
 * @param {object} order - Đối tượng Đơn hàng từ Mongoose
 */
export const sendOrderConfirmationEmail = async (toEmail, order) => {
  try {
    if (!toEmail) return;

    // Tạo danh sách sản phẩm dạng bảng HTML
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.price.toLocaleString('vi-VN')} đ</td>
        </tr>
      `
      )
      .join('');

    const mailOptions = {
      from: `"TechShop" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `[TechShop] Xác nhận đơn hàng #${order.orderId} thành công`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #1e88e5; text-align: center;">Cảm ơn bạn đã đặt hàng tại TechShop!</h2>
          <p>Xin chào <strong>${order.customerName}</strong>,</p>
          <p>Đơn hàng của bạn đã được hệ thống ghi nhận thành công.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Sản phẩm</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">SL</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: right;">Tổng thanh toán:</td>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: right; color: #e53935;">${order.totalPrice.toLocaleString('vi-VN')} đ</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 20px; background: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p><strong>Mã đơn hàng:</strong> ${order.orderId}</p>
            <p><strong>Phương thức thanh toán:</strong> ${order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản ngân hàng'}</p>
            <p><strong>Trạng thái thanh toán:</strong> ${order.paymentStatus}</p>
            <p><strong>Địa chỉ nhận hàng:</strong> ${order.shippingAddress}</p>
          </div>
          
          <p style="margin-top: 25px; font-size: 12px; color: #888; text-align: center;">
            Đây là email tự động, vui lòng không phản hồi email này. Mọi thắc mắc xin liên hệ hotline TechShop.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email đơn hàng ${order.orderId} đã được gửi tới: ${toEmail}`, info.messageId);
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi email xác nhận đơn hàng:', error);
    return false;
  }
};