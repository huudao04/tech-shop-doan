import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Row, Col, Typography, Card, Divider, message, Radio, Space, Select } from 'antd';
import { useCart } from '../context/CartContex.jsx';
import { useLocation, useNavigate } from 'react-router-dom'; 
import API from '../utils/axiosClient';
import { getImageUrl } from '../utils/imageUrl.js';
import axios from 'axios'; 

const { Title, Text } = Typography;

const Checkout = () => {
  const { cartItems, totalPrice: globalTotalPrice, updateCart } = useCart();
  const location = useLocation(); 
  const navigate = useNavigate(); 
  const [form] = Form.useForm();
  
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- STATE CHO VOUCHER ---
  const [voucherInput, setVoucherInput] = useState(''); 
  const [discountValue, setDiscountValue] = useState(0); 
  const [appliedVoucherCode, setAppliedVoucherCode] = useState(null); 
  const [voucherLoading, setVoucherLoading] = useState(false);

  // --- STATE CHO TÍNH TIỀN SHIP TỰ ĐỘNG ---
  const [shippingFee, setShippingFee] = useState(0);
  const [distanceText, setDistanceText] = useState('');
  const [addressOptions, setAddressOptions] = useState([]); 
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false); // Trạng thái đang gõ tìm địa chỉ

  // Quản lý timeout cho Debounce tìm kiếm
  const searchTimeoutRef = useRef(null);

  const displayItems = location.state?.checkoutItems || cartItems;
  const displayTotalPrice = location.state?.checkoutTotalPrice || globalTotalPrice;
  const finalTotalPrice = Math.max(0, displayTotalPrice - discountValue + shippingFee);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- LOGIC TÌM KIẾM GỢI Ý ĐỊA CHỈ (OSM) ---
  const fetchAddress = async (searchText) => {
    setIsSearching(true);
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&countrycodes=vn&limit=5`
      );
      const options = res.data.map(item => ({
        label: item.display_name,
        value: item.display_name, // Value này sẽ lưu vào form.shippingAddress
        lat: item.lat,
        lng: item.lon
      }));
      setAddressOptions(options);
    } catch (error) {
      console.error("Lỗi lấy gợi ý địa chỉ từ OSM:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchAddress = (searchText) => {
    if (!searchText || searchText.trim().length < 3) {
      setAddressOptions([]);
      return;
    }
    
    // Clear timeout cũ nếu người dùng đang gõ liên tục
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Đặt timeout mới (600ms sau khi ngừng gõ mới gọi API)
    searchTimeoutRef.current = setTimeout(() => {
      fetchAddress(searchText);
    }, 600);
  };

  // --- LOGIC GỌI BACKEND TÍNH TIỀN SHIP ---
  const handleSelectAddress = async (value, option) => {
    setShippingLoading(true);
    try {
      // Gửi tọa độ lên Backend để tính khoảng cách
      const res = await API.post('/api/shipping/calculate-fee', {
        lat: option.lat,
        lng: option.lng 
      });

      if (res.data.success) {
        setShippingFee(res.data.shippingFee);
        setDistanceText(res.data.distanceText);
        message.success(`Cập nhật phí ship: +${res.data.shippingFee.toLocaleString()} VNĐ (${res.data.distanceText})`);
      }
    } catch (error) {
      console.error("Lỗi tính tiền ship từ BE:", error);
      message.error("Không thể tính toán tiền ship. Vui lòng thử chọn địa chỉ khác!");
      setShippingFee(0);
      setDistanceText('');
    } finally {
      setShippingLoading(false);
    }
  };

  // --- LOGIC VOUCHER ---
  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) return message.warning('Vui lòng nhập mã giảm giá!');
    setVoucherLoading(true);
    try {
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
      message.error(error.response?.data?.message || 'Không thể áp dụng mã giảm giá này!');
      setDiscountValue(0);
      setAppliedVoucherCode(null);
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleCancelVoucher = () => {
    setVoucherInput('');
    setDiscountValue(0);
    setAppliedVoucherCode(null);
    message.info('Đã hủy áp dụng mã giảm giá');
  };

  // --- LOGIC THANH TOÁN ---
  const onFinish = async (values) => {
    if (displayItems.length === 0) {
      return message.warning('Giỏ hàng trống. Vui lòng quay lại giỏ hàng!');
    }

    setLoading(true);
    try {
      const orderData = {
        customerName: values.customerName,
        phoneNumber: values.phoneNumber,
        shippingAddress: values.shippingAddress, // Gửi full chuỗi địa chỉ
        paymentMethod: paymentMethod,
        shippingFee: shippingFee, 
        distance: distanceText,   
        totalPrice: finalTotalPrice, 
        voucherCode: appliedVoucherCode, 
        items: displayItems.map(item => ({
          productId: item._id || item.id, 
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))
      };

      const response = await API.post('/api/orders', orderData);

      if (response.data.success) {
        const createdOrder = response.data.order;
        message.success('Đặt đơn hàng thành công!');
        updateCart([]); 

        if (paymentMethod === 'BANK_TRANSFER') {
          const paymentGateway = response.data.paymentGateway;
          if (!paymentGateway?.checkoutUrl || !paymentGateway?.fields) {
            return message.error('Không lấy được thông tin cổng thanh toán.');
          }
          const formDom = document.createElement('form');
          formDom.method = 'POST';
          formDom.action = paymentGateway.checkoutUrl;
          formDom.style.display = 'none';

          Object.entries(paymentGateway.fields).forEach(([key, value]) => {
            const inputDom = document.createElement('input');
            inputDom.type = 'hidden';
            inputDom.name = key;
            inputDom.value = value ?? '';
            formDom.appendChild(inputDom);
          });
          document.body.appendChild(formDom);
          formDom.submit();
        } else {
          navigate(`/my-orders?status=success&orderId=${createdOrder._id}`);
        }
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra khi xử lý đơn hàng!');
    } finally {
      setLoading(false);
    }
  };

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

  const addressSelectField = (
    <Form.Item name="shippingAddress" label="Địa chỉ nhận hàng (Gõ để tìm kiếm)" rules={[{ required: true, message: 'Vui lòng chọn địa chỉ cụ thể' }]}>
      <Select
        showSearch
        placeholder="Gõ số nhà, tên đường để tự động tính phí ship..."
        defaultActiveFirstOption={false}
        showArrow={false}
        filterOption={false}
        onSearch={handleSearchAddress}
        onSelect={handleSelectAddress}
        notFoundContent={isSearching ? "Đang tìm vị trí..." : "Không tìm thấy (hãy thử gõ chi tiết hơn)"}
        options={addressOptions}
        size={isMobile ? "large" : "middle"}
      />
    </Form.Item>
  );

  return (
    <div style={{ padding: isMobile ? '16px' : '40px', maxWidth: 1200, margin: '0 auto', paddingBottom: isMobile ? '120px' : '40px' }}>
      <Title level={2}>Thanh toán</Title>
      
      {isMobile ? (
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ paymentMethod: 'COD' }}>
          <div style={{ marginBottom: 12 }}>
            <Card title="Thông tin giao hàng">
              <Form.Item name="customerName" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                <Input placeholder="Nhập tên người nhận" size="large" />
              </Form.Item>
              <Form.Item name="phoneNumber" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                <Input placeholder="Nhập số điện thoại" size="large" />
              </Form.Item>
              {addressSelectField}             
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

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Phí vận chuyển {distanceText && `(${distanceText})`}:</Text>
                <Text strong>{shippingFee > 0 ? `+${shippingFee.toLocaleString()} VNĐ` : '0đ'}</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><Title level={5} style={{ margin: 0 }}>Tổng cộng:</Title></div>
                <div><Title level={5} type="danger" style={{ margin: 0 }}>{finalTotalPrice.toLocaleString()} VNĐ</Title></div>
              </div>
            </Card>

            <Divider orientation="left">Phương thức thanh toán</Divider>
            <Form.Item name="paymentMethod">
              <Radio.Group onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
                <Space direction="vertical">
                  <Radio value="COD">Thanh toán khi nhận hàng (COD)</Radio>
                  <Radio value="BANK_TRANSFER">Chuyển khoản ngân hàng thanh toán bằng Qr Code</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <div style={{ marginTop: 16 }}>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                {paymentMethod === 'BANK_TRANSFER' ? 'CHUYỂN SANG CỔNG THANH TOÁN' : 'XÁC NHẬN ĐẶT HÀNG'}
              </Button>
            </div>
          </div>
        </Form>
      ) : (
        <Row gutter={32}>
          <Col span={14}>
            <Card title="Thông tin giao hàng">
              <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ paymentMethod: 'COD' }}>
                <Form.Item name="customerName" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                  <Input placeholder="Nhập tên người nhận" />
                </Form.Item>
                <Form.Item name="phoneNumber" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                  <Input placeholder="Nhập số điện thoại" />
                </Form.Item>

                {addressSelectField}

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

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text>Tạm tính:</Text>
                <Text>{displayTotalPrice.toLocaleString()}đ</Text>
              </div>

              {discountValue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text>Giảm giá:</Text>
                  <Text type="danger" strong>-{discountValue.toLocaleString()} VNĐ</Text>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text>Phí vận chuyển {distanceText && `(${distanceText})`}:</Text>
                <Text strong>{shippingFee > 0 ? `+${shippingFee.toLocaleString()} VNĐ` : '0đ'}</Text>
              </div>

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