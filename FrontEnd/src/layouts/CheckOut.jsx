import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Row, Col, Typography, Card, Divider, message, Radio, Space } from 'antd';
import { useCart } from '../context/CartContex.jsx';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useLocation để nhận state
import API from '../utils/axiosClient';
import { getImageUrl } from '../utils/imageUrl.js';

const { Title, Text } = Typography;

const Checkout = () => {
  const { cartItems, totalPrice: globalTotalPrice, updateCart } = useCart();
  const location = useLocation(); // Hook lấy dữ liệu truyền từ trang Cart sang
  const navigate = useNavigate(); // Hook để điều hướng trang
  const [form] = Form.useForm();
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // LOGIC MỚI: Ưu tiên lấy hàng từ checkbox trang Cart truyền sang, nếu không có thì lấy cả giỏ (fallback)
  const displayItems = location.state?.checkoutItems || cartItems;
  const displayTotalPrice = location.state?.checkoutTotalPrice || globalTotalPrice;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

 const onFinish = async (values) => {
  if (displayItems.length === 0) {
    return message.warning('Danh sách mặt hàng thanh toán trống. Vui lòng quay lại giỏ hàng!');
  }

  setLoading(true);
  try {
      // Lấy thông tin người dùng hiện tại từ localStorage để gắn vào đơn hàng
    const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
    // Đóng gói dữ liệu chuẩn bằng cách lấy _id trực tiếp từ cấu trúc DB sản phẩm
    const orderData = {
      customerName: values.customerName,
      phoneNumber: values.phoneNumber,
      shippingAddress: values.shippingAddress,
      paymentMethod: paymentMethod,
      totalPrice: displayTotalPrice,
      items: displayItems.map(item => ({
        // Lấy chính xác mã sản phẩm (_id từ MongoDB), nếu không có mới tìm fallback
        productId: item._id || item.id, 
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    };

    // Log ra console để ông tự kiểm tra trước khi bắn lên server
    console.log("Dữ liệu đơn hàng chuẩn bị gửi đi:", orderData);

    // Gọi API tạo đơn hàng đến Backend
    const response = await API.post('/api/orders', orderData);

    if (response.data.success) {
      const createdOrder = response.data.order;
      message.success('Đặt đơn hàng thành công!');
      updateCart([]); // Xóa sạch giỏ hàng

      // Điều hướng trang dựa theo phương thức thanh toán
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
        // Ship COD thì chuyển hướng sang màn thành công thông thường
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
  return (
    <div style={{ padding: isMobile ? '16px' : '40px', maxWidth: 1200, margin: '0 auto', paddingBottom: isMobile ? '120px' : '40px' }}>
      <Title level={2}>Thanh toán</Title>
      {isMobile ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <Card title="Thông tin giao hàng">
              <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ paymentMethod: 'COD' }}>
                <Form.Item name="customerName" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                  <Input placeholder="Nguyễn Hữu Đạo" size="large" />
                </Form.Item>
                <Form.Item name="phoneNumber" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                  <Input placeholder="090..." size="large" />
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

                {/* On mobile we keep the submit hidden because we show a fixed bottom bar */}
                <div style={{ display: 'none' }}>
                  <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    {paymentMethod === 'BANK_TRANSFER' ? 'CHUYỂN SANG CỔNG THANH TOÁN' : 'XÁC NHẬN ĐẶT HÀNG'}
                  </Button>
                </div>
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
                      <div style={{ fontSize: 12, color: '#666' }}>x {item.quantity}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#d32f2f' }}>{(item.price * item.quantity).toLocaleString()} đ</div>
                  </div>
                </div>
              ))}
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>Tổng cộng:</Title>
                </div>
                <div>
                  <Title level={5} type="danger" style={{ margin: 0 }}>{displayTotalPrice.toLocaleString()} VNĐ</Title>
                </div>
              </div>
            </Card>
          </div>

          {/* Mobile fixed bottom bar with total + action */}
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 68, background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 16px', zIndex: 1300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#666' }}>Tổng</div>
                <div style={{ fontWeight: 800, color: '#d32f2f', fontSize: 16 }}>{displayTotalPrice.toLocaleString()} VNĐ</div>
              </div>
              <div style={{ minWidth: 160 }}>
                <Button type="primary" size="large" block onClick={() => form.submit()} loading={loading}>
                  {paymentMethod === 'BANK_TRANSFER' ? 'CHUYỂN SANG CỔNG' : 'XÁC NHẬN'}
                </Button>
              </div>
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
                  <Input placeholder="Nguyễn Hữu Đạo" />
                </Form.Item>
                <Form.Item name="phoneNumber" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                  <Input placeholder="090..." />
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
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4}>Tổng cộng:</Title>
                <Title level={4} type="danger">{displayTotalPrice.toLocaleString()} VNĐ</Title>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Checkout;