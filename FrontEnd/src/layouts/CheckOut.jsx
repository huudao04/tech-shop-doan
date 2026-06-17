import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Row, Col, Typography, Card, Divider, message, Radio, Space } from 'antd';
import { useCart } from '../context/CartContex.jsx';
import { useLocation, useNavigate } from 'react-router-dom'; 
import API from '../utils/axiosClient';
import { getImageUrl } from '../utils/imageUrl.js';

const { Title, Text } = Typography;

const Checkout = () => {
  const { cartItems, totalPrice: globalTotalPrice, updateCart } = useCart();
  const location = useLocation(); 
  const navigate = useNavigate(); 
  const [form] = Form.useForm();
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- LOGIC MÃ GIẢM GIÁ (VOUCHER) ---
  const [voucherInput, setVoucherInput] = useState(''); // Lưu ký tự user đang gõ
  const [discountValue, setDiscountValue] = useState(0); // Số tiền được giảm
  const [appliedVoucherCode, setAppliedVoucherCode] = useState(null); // Mã đã áp dụng thành công
  const [voucherLoading, setVoucherLoading] = useState(false);

  const displayItems = location.state?.checkoutItems || cartItems;
  const displayTotalPrice = location.state?.checkoutTotalPrice || globalTotalPrice;

  // Tính số tiền cuối cùng sau khi đã trừ đi khoản giảm giá (không âm)
  const finalTotalPrice = Math.max(0, displayTotalPrice - discountValue);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hàm xử lý kiểm tra và áp dụng mã giảm giá
  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) {
      return message.warning('Vui lòng nhập mã giảm giá!');
    }

    setVoucherLoading(true);
    try {
      // Gọi lên API check voucher đã viết dưới BE
      const response = await API.post('/api/vouchers/check', {
        code: voucherInput.trim(),
        orderAmount: displayTotalPrice
      });

      if (response.data.success) {
        setDiscountValue(response.data.discountValue);
        setAppliedVoucherCode(voucherInput.trim().toUpperCase());
        message.success(`Áp dụng mã thành công! Bạn được giảm ${response.data.discountValue.toLocaleString()} VNĐ`);
      }
    } catch (error) {
      console.error("Lỗi áp dụng voucher:", error);
      const errorMsg = error.response?.data?.message || 'Không thể áp dụng mã giảm giá này!';
      message.error(errorMsg);
      // Reset lại nếu áp dụng thất bại
      setDiscountValue(0);
      setAppliedVoucherCode(null);
    } finally {
      setVoucherLoading(false);
    }
  };

  // Hàm hủy bỏ mã đã áp dụng
  const handleCancelVoucher = () => {
    setVoucherInput('');
    setDiscountValue(0);
    setAppliedVoucherCode(null);
    message.info('Đã hủy áp dụng mã giảm giá');
  };

  const onFinish = async (values) => {
    if (displayItems.length === 0) {
      return message.warning('Danh sách mặt hàng thanh toán trống. Vui lòng quay lại giỏ hàng!');
    }

    setLoading(true);
    try {
      const orderData = {
        customerName: values.customerName,
        phoneNumber: values.phoneNumber,
        shippingAddress: values.shippingAddress,
        paymentMethod: paymentMethod,
        totalPrice: finalTotalPrice, // Bắn số tiền thực tế sau giảm giá lên BE
        voucherCode: appliedVoucherCode, // Gửi kèm mã voucher để BE lưu vết / cắn số lượng
        items: displayItems.map(item => ({
          productId: item._id || item.id, 
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))
      };

      console.log("Dữ liệu đơn hàng chuẩn bị gửi đi:", orderData);

      const response = await API.post('/api/orders', orderData);

      if (response.data.success) {
        const createdOrder = response.data.order;
        message.success('Đặt đơn hàng thành công!');
        updateCart([]); 

        if (paymentMethod === 'BANK_TRANSFER') {
          const paymentGateway = response.data.paymentGateway;

          if (!paymentGateway?.checkoutUrl || !paymentGateway?.fields) {
            message.error('Không lấy được thông tin cổng thanh toán SePay.');
            return;
          }

          const form = document.createElement('form');
          form.method = 'POST';
          form.action = paymentGateway.checkoutUrl;
          form.style.display = 'none';

          Object.entries(paymentGateway.fields).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value ?? '';
            form.appendChild(input);
          });

          document.body.appendChild(form);
          form.submit();
        } else {
          navigate(`/my-orders?status=success&orderId=${createdOrder._id}`);
        }
      }
    } catch (error) {
      console.error("Lỗi FE khi đặt hàng:", error);
      const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra khi xử lý đơn hàng!';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // UI Khối Nhập Voucher dùng chung cho cả bản Mobile và Desktop
  const renderVoucherSection = () => (
    <div style={{ margin: '16px 0' }}>
      <Text strong>Mã giảm giá (Voucher)</Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <Input 
          placeholder="Nhập mã ví dụ: CONGNGHE2026" 
          value={voucherInput}
          onChange={(e) => setVoucherInput(e.target.value)}
          disabled={!!appliedVoucherCode}
          style={{ textTransform: 'uppercase' }}
        />
        {appliedVoucherCode ? (
          <Button type="default" danger onClick={handleCancelVoucher}>Hủy bỏ</Button>
        ) : (
          <Button type="primary" onClick={handleApplyVoucher} loading={voucherLoading}>Áp dụng</Button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? '16px' : '40px', maxWidth: 1200, margin: '0 auto', paddingBottom: isMobile ? '120px' : '40px' }}>
      <Title level={2}>Thanh toán</Title>
      {isMobile ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <Card title="Thông tin giao hàng">
              <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ paymentMethod: 'COD' }}>
                <Form.Item name="customerName" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                  <Input placeholder="Nhập tên người nhận" size="large" />
                </Form.Item>
                <Form.Item name="phoneNumber" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                  <Input placeholder="Nhập số điện thoại" size="large" />
                </Form.Item>
                <Form.Item name="shippingAddress" label="Địa chỉ nhận hàng" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ' }]}>
                  <Input.TextArea rows={3} placeholder="Số nhà, tên đường, quận/huyện..." />
                </Form.Item>               
              </Form>
            </Card>
          </div>

          <div>
            <Card title="Đơn hàng của bạn">
              {displayItems.map(item => (
                <div key={item._id || item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={getImageUrl(item.image, '/images/default-product.jpg')} alt={item.name} style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'red' }}>x {item.quantity}</div>
                    </div>
                  </div>
                </div>
              ))}
              
              <Divider style={{ margin: '12px 0' }} />
              {renderVoucherSection()}
              <Divider style={{ margin: '12px 0' }} />

              {discountValue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Giảm giá:</Text>
                  <Text delete type="secondary">-{discountValue.toLocaleString()} VNĐ</Text>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><Title level={5} style={{ margin: 0 }}>Tổng cộng:</Title></div>
                <div><Title level={5} type="danger" style={{ margin: 0 }}>{finalTotalPrice.toLocaleString()} VNĐ</Title></div>
              </div>
            </Card>

            <Divider orientation="left">Phương thức thanh toán</Divider>
            <Form form={form} component={false}>
              <Form.Item name="paymentMethod">
                <Radio.Group onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
                  <Space direction="vertical">
                    <Radio value="COD">Thanh toán khi nhận hàng (COD)</Radio>
                    <Radio value="BANK_TRANSFER">Chuyển khoản ngân hàng thanh toán bằng Qr Code</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
            </Form>

            <div style={{ marginTop: 16 }}>
              <Button type="primary" size="large" block loading={loading} onClick={() => form.submit()}>
                {paymentMethod === 'BANK_TRANSFER' ? 'CHUYỂN SANG CỔNG THANH TOÁN' : 'XÁC NHẬN ĐẶT HÀNG'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Row gutter={32}>
          {/* Cột trái: Form thông tin khách hàng */}
          <Col span={14}>
            <Card title="Thông tin giao hàng">
              <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ paymentMethod: 'COD' }}>
                <Form.Item name="customerName" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                  <Input placeholder="Nhập tên người nhận" />
                </Form.Item>
                <Form.Item name="phoneNumber" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                  <Input placeholder="Nhập số điện thoại" />
                </Form.Item>
                <Form.Item name="shippingAddress" label="Địa chỉ nhận hàng" rules={[{ required: true, message: 'Vui lòng nhập địa chỉ' }]}>
                  <Input.TextArea rows={3} placeholder="Số nhà, tên đường, quận/huyện..." />
                </Form.Item>

                <Divider orientation="left">Phương thức thanh toán</Divider>
                <Form.Item name="paymentMethod">
                  <Radio.Group onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
                    <Space direction="vertical">
                      <Radio value="COD">Thanh toán khi nhận hàng (COD)</Radio>
                      <Radio value="BANK_TRANSFER">Chuyển khoản ngân hàng thanh toán bằng Qr Code</Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>

                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                  {paymentMethod === 'BANK_TRANSFER' ? 'CHUYỂN SANG CỔNG THANH TOÁN' : 'XÁC NHẬN ĐẶT HÀNG'}
                </Button>
              </Form>
            </Card>
          </Col>

          {/* Cột phải: Tóm tắt đơn hàng */}
          <Col span={10}>
            <Card title="Đơn hàng của bạn">
              {displayItems.map(item => (
                <div key={item._id || item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text>{item.name} x {item.quantity}</Text>
                  <Text strong>{(item.price * item.quantity).toLocaleString()}đ</Text>
                </div>
              ))}
              
              <Divider style={{ margin: '12px 0' }} />
              {renderVoucherSection()}
              <Divider style={{ margin: '12px 0' }} />

              {discountValue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text>Tạm tính:</Text>
                  <Text>{displayTotalPrice.toLocaleString()}đ</Text>
                </div>
              )}
              {discountValue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text>Giảm giá:</Text>
                  <Text type="danger" strong>-{discountValue.toLocaleString()} VNĐ</Text>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4}>Tổng cộng:</Title>
                <Title level={4} type="danger">{finalTotalPrice.toLocaleString()} VNĐ</Title>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Checkout;