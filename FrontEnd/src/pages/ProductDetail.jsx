import React, { useState, useEffect } from 'react';
import API from '../utils/axiosClient';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Typography, Button, Tag, InputNumber, Divider, message, Space, Spin, Rate, Card, Form, Input, List, Avatar } from 'antd';
import { ShoppingCartOutlined, ThunderboltOutlined, ArrowLeftOutlined, UserOutlined, MessageOutlined } from '@ant-design/icons';
import { useCart } from '../context/CartContex.jsx';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ProductDetail = () => {
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]); // State lưu danh sách đánh giá của sản phẩm
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // Trạng thái khi đang gửi đánh giá
  const [quantity, setQuantity] = useState(1);
  const { _id } = useParams(); 
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const { cartItems, updateCart } = useCart();

  // 1. Lấy dữ liệu chi tiết sản phẩm và các đánh giá từ API Backend
  const fetchProductAndReviews = () => {
    setLoading(true);
    API.get('/api/products/' + _id)
      .then(response => {
        // Backend trả cố định: { product: { ... } }
        const productData = response.data?.product ?? null;

        setProduct(productData);
        setReviews(response.data?.reviews ?? productData?.reviews ?? []);
      })
      .catch(error => {
        console.error('Lỗi khi lấy sản phẩm:', error);
        message.error('Không thể tải thông tin sản phẩm');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProductAndReviews();
  }, [_id]);

  // 2. Hàm thêm vào giỏ hàng
  const handleAddToCart = (showSuccessMessage = true) => {
    if (!product) return null;
    
    const existingItem = cartItems.find(item => item.id === product._id);
    let newCart;

    if (existingItem) {
      newCart = cartItems.map(item =>
        item.id === product._id ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      newCart = [...cartItems, {
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: quantity
      }];
    }

    updateCart(newCart);
    if (showSuccessMessage) {
      message.success(`🛒 Đã thêm ${quantity} sản phẩm "${product.name}" vào giỏ hàng!`);
    }
    return newCart;
  };

  // 3. Hàm xử lý tính năng "Mua ngay"
  const handleBuyNow = () => {
    if (!product) return;

    const itemToPay = [{
      id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: quantity
    }];

    const totalPriceToPay = product.price * quantity;

    message.loading('Đang chuẩn bị đơn hàng...', 1);
    
    setTimeout(() => {
      navigate('/cart/checkout', {
        state: {
          checkoutItems: itemToPay,
          checkoutTotalPrice: totalPriceToPay
        }
      });
    }, 1000);
  };

  // 4. Hàm xử lý khi Người dùng gửi Đánh giá mới
  const onFinishReview = async (values) => {
    setSubmitting(true);
    try {
      const response = await API.post(`/api/products/${_id}/reviews`, values);
      if (response.data.success) {
        message.success('Cảm ơn bạn đã gửi đánh giá cho sản phẩm!');
        form.resetFields();
        // Đẩy đánh giá mới vừa tạo lên đầu danh sách hiển thị mà không cần reload trang
        setReviews([response.data.review, ...reviews]);
      }
    } catch (error) {
      console.error('Lỗi gửi đánh giá:', error);
      message.error('Gửi đánh giá thất bại, vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Đang tải chi tiết sản phẩm..." />
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text type="secondary">Sản phẩm không tồn tại hoặc đã bị xóa khỏi hệ thống.</Text>
        <br /><br />
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')}>Quay lại danh sách</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', borderRadius: 8, marginTop: 20 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        Quay lại
      </Button>
      
      {/* ─── KHỐI THÔNG TIN CHI TIẾT SẢN PHẨM ─── */}
      <Card borderless="true" style={{ background: '#fff', borderRadius: 8, marginBottom: 24 }} className="shadow-sm">
        <Row gutter={[40, 32]}>
          {/* Cột trái: Ảnh sản phẩm */}
          <Col xs={24} md={12} style={{ textAlign: 'center' }}>
            <img 
              src={`/images/${Array.isArray(product.image) ? product.image[0] : product.image}`} 
              alt={product.name} 
              style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 4 }}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/400'; }}
            />
          </Col>

          {/* Cột phải: Thông tin chi tiết */}
          <Col xs={24} md={12}>
            <Space size="middle" style={{ marginBottom: 10 }}>
              <Tag color="blue" style={{ textTransform: 'uppercase' }}>{product.brand || 'Thương hiệu'}</Tag>
              <Tag color="green">{product.category || 'Danh mục'}</Tag>
            </Space>
            
            <Title level={2} style={{ margin: '0 0 15px 0' }}>{product.name}</Title>
            
            <div style={{ background: '#fafafa', padding: '15px 20px', borderRadius: 8, marginBottom: 20 }}>
              <Text type="danger" style={{ fontSize: 28, fontWeight: 'bold' }}>
                {product.price?.toLocaleString()} VNĐ
              </Text>
            </div>
            
            <Divider style={{ margin: '15px 0' }} />
            
            <Paragraph>
              <Text strong>Mô tả chi tiết sản phẩm:</Text>
              <div style={{ marginTop: 8, color: '#595959', lineHeight: '1.6' }}>
                {product.description || 'Chưa có thông tin mô tả cụ thể dành cho sản phẩm này.'}
              </div>
            </Paragraph>

            <Divider style={{ margin: '15px 0' }} />

            <div style={{ marginBottom: 25, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Text strong>Số lượng mua: </Text>
              <InputNumber 
                min={1} 
                max={product.stock || 99} 
                value={quantity} 
                onChange={(val) => setQuantity(val || 1)} 
                style={{ width: 80 }}
              />
              <Text type="secondary" style={{ fontSize: 13 }}>
                (Còn {product.stock || 0} sản phẩm trong kho)
              </Text>
            </div>

            <Space size="large" style={{ width: '100%' }}>
              <Button 
                type="default" 
                size="large" 
                icon={<ShoppingCartOutlined />}
                disabled={product.stock <= 0}
                onClick={() => handleAddToCart(true)}
                style={{ minWidth: 160, height: 48, borderColor: '#1890ff', color: '#1890ff' }}
              >
                Thêm vào giỏ
              </Button>
              <Button 
                type="primary" 
                danger 
                size="large" 
                icon={<ThunderboltOutlined />}
                disabled={product.stock <= 0}
                onClick={handleBuyNow}
                style={{ minWidth: 160, height: 48 }}
              >
                Mua ngay
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ─── KHỐI ĐÁNH GIÁ & BÌNH LUẬN TỪ NGƯỜI DÙNG ─── */}
      <Row gutter={[24, 24]}>
        {/* Bên trái: Danh sách các đánh giá hiện có */}
        <Col xs={24} lg={14}>
          <Card title={<Space><MessageOutlined /> <Text strong>Đánh giá từ khách hàng ({reviews.length})</Text></Space>} className="shadow-sm rounded-lg">
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Text type="secondary">Sản phẩm chưa có đánh giá nào. Hãy là người đầu tiên đánh giá!</Text>
              </div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={reviews}
                pagination={{ pageSize: 5, size: 'small' }}
                renderItem={(item) => (
                  <List.Item style={{ padding: '16px 0', alignItems: 'flex-start' }}>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />}
                      title={
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>{item.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                            </Text>
                          </div>
                          <Rate disabled defaultValue={item.rating} style={{ fontSize: 12 }} className="text-amber-400" />
                        </Space>
                      }
                      description={
                        <div style={{ marginTop: 6 }}>
                          {/* Nội dung khách bình luận */}
                          <p style={{ color: '#262626', margin: '0 0 8px 0' }}>{item.comment}</p>
                          
                          {/* Khối hiển thị câu trả lời của Admin nếu có */}
                          {item.reply && (
                            <div style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: 6, borderLeft: '3px solid #10b981', marginTop: 8 }}>
                              <Text strong style={{ color: '#10b981', fontSize: 12, display: 'block', marginBottom: 2 }}>
                                Phản hồi từ cửa hàng:
                              </Text>
                              <p style={{ margin: 0, color: '#434343', italic: 'true', fontSize: 13 }}>{item.reply}</p>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Bên phải: Form viết câu đánh giá mới */}
        <Col xs={24} lg={10}>
          <Card title={<Text strong>Viết đánh giá của bạn</Text>} className="shadow-sm rounded-lg">
            <Form form={form} layout="vertical" onFinish={onFinishReview}>
              <Form.Item
                name="name"
                label="Họ và tên của bạn"
                rules={[{ required: true, message: 'Vui lòng nhập họ tên để gửi đánh giá!' }]}
              >
                <Input placeholder="Ví dụ: Nguyễn Văn A..." />
              </Form.Item>

              <Form.Item
                name="rating"
                label="Chọn số sao đánh giá"
                rules={[{ required: true, message: 'Vui lòng chọn số sao!' }]}
                initialValue={5}
              >
                <Rate className="text-amber-400" />
              </Form.Item>

              <Form.Item
                name="comment"
                label="Cảm nhận về sản phẩm"
                rules={[{ required: true, message: 'Vui lòng viết nội dung bình luận!' }]}
              >
                <TextArea rows={4} placeholder="Sản phẩm dùng rất tốt, đóng gói cẩn thận, giao hàng nhanh..." />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={submitting} block style={{ height: 40 }}>
                  Gửi đánh giá sản phẩm
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProductDetail;