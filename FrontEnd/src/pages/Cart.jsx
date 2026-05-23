import React, { useState, useEffect } from 'react';
import { Table, Button, InputNumber, Space, Typography, Empty, Row, Col, Card, message } from 'antd';
import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Link, useSearchParams, useNavigate } from 'react-router-dom'; // Thêm useNavigate để truyền dữ liệu ngầm
import { useCart } from '../context/CartContex.jsx';

const { Title, Text } = Typography;

const Cart = () => {
  const { cartItems, updateCart, cartLoading } = useCart();
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const navigate = useNavigate(); // Khai báo hook điều hướng trang

  const getImageSource = (image) => Array.isArray(image) ? image[0] : image;
  
  // Tự động tích chọn TẤT CẢ sản phẩm khi người dùng vừa vào trang giỏ hàng
  useEffect(() => {
    if (cartItems.length > 0 && !isInitialized) {
      setSelectedRowKeys(cartItems.map(item => item.id));
      setIsInitialized(true); 
    }
  }, [cartItems, isInitialized]);

  // Luồng bắt trạng thái trả về từ cổng SePay chuyển hướng về (giữ nguyên logic cũ)
  useEffect(() => {
    const status = searchParams.get('status');

    if (status) {
      if (status === 'success') {
        message.success({
          content: '🎉 Thanh toán qua cổng SePay thành công! Đơn hàng của bạn đang được xử lý.',
          duration: 4,
          style: { marginTop: '10vh' }
        });
      } else if (status === 'error') {
        message.error({
          content: '❌ Giao dịch thanh toán thất bại hoặc có lỗi xảy ra. Vui lòng kiểm tra lại!',
          duration: 4,
          style: { marginTop: '10vh' }
        });
      } else if (status === 'cancel') {
        message.warning({
          content: '⚠️ Bạn đã hủy bỏ giao dịch thanh toán qua cổng ngân hàng.',
          duration: 4,
          style: { marginTop: '10vh' }
        });
      }

      searchParams.delete('status');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Logic tính tổng tiền dựa trên bộ lọc các sản phẩm được tích chọn
  const selectedTotalPrice = cartItems
    .filter(item => selectedRowKeys.includes(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Cấu hình checkbox rowSelection dành riêng cho Ant Design Table
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  const updateQuantity = (id, quantity) => {
    const qty = Number(quantity) || 1;
    const newCart = cartItems.map(item => 
      item.id === id ? { ...item, quantity: qty } : item
    );
    updateCart(newCart);
  };

  const removeItem = (id) => {
    const newCart = cartItems.filter(item => item.id !== id);
    updateCart(newCart);
    // Đồng thời loại bỏ id khỏi danh sách check nếu item bị xóa
    setSelectedRowKeys(prev => prev.filter(key => key !== id));
  };

  // Hàm xử lý điều hướng sang Checkout kèm dữ liệu được tick chọn
  const handleProceedToCheckout = () => {
    const itemsToPay = cartItems.filter(item => selectedRowKeys.includes(item.id));

    if (itemsToPay.length === 0) {
      return message.warning('Vui lòng tích chọn ít nhất một sản phẩm để tiến hành thanh toán!');
    }

    // Chuyển trang và đính kèm thông tin hàng được chọn vào location.state
    navigate('/cart/checkout', {
      state: {
        checkoutItems: itemsToPay,
        checkoutTotalPrice: selectedTotalPrice
      }
    });
  };

  if (cartLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <ShoppingCartOutlined style={{ fontSize: 42, marginBottom: 16 }} />
        <div>Đang tải giỏ hàng từ hệ thống...</div>
      </div>
    );
  }

  const columns = [
    {
      title: 'Sản phẩm',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <img 
            src={getImageSource(record.image) ? `/images/${getImageSource(record.image)}` : 'https://via.placeholder.com/50'} 
            alt={text} 
            style={{ width: 50 }} 
            onError={(e) => { e.target.src = 'https://via.placeholder.com/50'; }}
          />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Loại sản phẩm',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Thuơng hiệu',
      dataIndex: 'brand',
      key: 'brand',
    },
    {
      title: 'Đơn giá',
      dataIndex: 'price',
      key: 'price',
      render: (price) => `${Number(price ?? 0).toLocaleString()} VNĐ`,
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      render: (_, record) => (
        <InputNumber 
          min={1} 
          value={record.quantity ?? 1} 
          onChange={(val) => updateQuantity(record.id, val ?? 1)} 
        />
      ),
    },
    {
      title: 'Thành tiền',
      key: 'subtotal',
      render: (_, record) => `${Number((record.price ?? 0) * (record.quantity ?? 0)).toLocaleString()} VNĐ`,
    },
    {
      title: 'Xóa',
      key: 'action',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(record.id)} />
      ),
    },
  ];

  if (cartItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Empty description="Giỏ hàng của bạn đang trống" />
        <Link to="/"><Button type="primary" size="large">Mua sắm ngay</Button></Link>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', margin: '0 auto', padding: '20px' }}>
      <Title level={2}><ShoppingCartOutlined /> Giỏ hàng</Title>
      <Row gutter={24}>
        <Col span={16}>
          <Table 
            rowSelection={rowSelection} 
            columns={columns} 
            dataSource={cartItems} 
            rowKey="id" 
            pagination={false} 
          />
        </Col>
        <Col span={8}>
          <Card title="Thanh toán">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text>Tổng cộng ({selectedRowKeys.length} món):</Text>
              <Text type="danger" strong style={{ fontSize: 20 }}>
                {Number(selectedTotalPrice ?? 0).toLocaleString()} VNĐ
              </Text>
            </div>
            <Button type="primary" block size="large" onClick={handleProceedToCheckout}>
              TIẾN HÀNH ĐẶT HÀNG
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Cart;