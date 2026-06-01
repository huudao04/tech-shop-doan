import React, { useState, useEffect } from 'react';
import API from '../utils/axiosClient';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Row, Col, Typography, Button, Tag, InputNumber, Divider, message, Space, Spin, Rate, Card, Form, Input, List, Avatar, Popconfirm, Modal } from 'antd';
import { ShoppingCartOutlined, ThunderboltOutlined, ArrowLeftOutlined, UserOutlined, MessageOutlined, EditOutlined, DeleteOutlined, CommentOutlined } from '@ant-design/icons';
import { useCart } from '../context/CartContex.jsx';
import { getImageUrl } from '../utils/imageUrl.js';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const ProductDetail = () => {
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { _id } = useParams(); 
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const location = useLocation();
  
  const { cartItems, updateCart } = useCart();

  // Đọc thông tin tài khoản đang đăng nhập từ localStorage để so sánh quyền sở hữu review
  const currentUser = JSON.parse(localStorage.getItem('user')) || null; 

  // State phục vụ tính năng sửa đổi đánh giá
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);

  // State phục vụ tính năng trao đổi thảo luận qua lại
  const [replyInputs, setReplyInputs] = useState({}); // Lưu text nhập tạm thời cho từng ReviewId

  const productImages = React.useMemo(() => {
    if (!product?.image) return [];

    const images = Array.isArray(product.image) ? product.image : [product.image];
    return images
      .map((image) => getImageUrl(image, ''))
      .filter((image) => Boolean(image));
  }, [product]);

  const fetchProductAndReviews = () => {
    setLoading(true);
    API.get('/api/products/' + _id)
      .then(response => {
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

  useEffect(() => {
    setActiveImageIndex(0);
  }, [_id, product?.image]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (productImages.length <= 1) return undefined;

    const timer = setInterval(() => {
      setActiveImageIndex((currentIndex) => (currentIndex + 1) % productImages.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [productImages]);

  useEffect(() => {
    if (location.hash === '#reviews-section') {
      const timer = setTimeout(() => {
        const element = document.getElementById('reviews-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [location.hash, reviews.length]);

  const handleAddToCart = (showSuccessMessage = true) => {
    if (!product) return null;
    const existingItem = cartItems.find(item => item.id === product._id);
    let newCart;
    if (existingItem) {
      newCart = cartItems.map(item => item.id === product._id ? { ...item, quantity: item.quantity + quantity } : item);
    } else {
      newCart = [...cartItems, { id: product._id, name: product.name, price: product.price, image: product.image, quantity: quantity, brand: product.brand, category: product.category }];
    }
    updateCart(newCart);
    if (showSuccessMessage) message.success(`🛒 Đã thêm ${quantity} sản phẩm vào giỏ hàng!`);
    return newCart;
  };

  const handleBuyNow = () => {
    if (!product) return;
    const itemToPay = [{ id: product._id, name: product.name, price: product.price, image: product.image, quantity: quantity, brand: product.brand, category: product.category }];
    const totalPriceToPay = product.price * quantity;
    message.loading('Đang chuẩn bị đơn hàng...', 0.5);
    setTimeout(() => { navigate('/cart/checkout', { state: { checkoutItems: itemToPay, checkoutTotalPrice: totalPriceToPay } }); }, 500);
  };

  // Tạo mới đánh giá
  const onFinishReview = async (values) => {
    if (!currentUser) {
      message.warning('Vui lòng đăng nhập tài khoản trước khi gửi đánh giá!');
      return;
    }
    setSubmitting(true);
    try {
      const response = await API.post(`/api/products/${_id}/reviews`, values);
      if (response.data.success) {
        message.success('Cảm ơn bạn đã gửi đánh giá cho sản phẩm!');
        form.resetFields();
        fetchProductAndReviews(); // Gọi tải lại để đồng bộ thông tin bao gồm cả UserId vừa ghi
      }
    } catch (error) {
      message.error('Gửi đánh giá thất bại, vui lòng đăng nhập và thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  // Mở modal sửa đổi đánh giá
  const openEditReview = (review) => {
    setEditingReviewId(review._id);
    editForm.setFieldsValue({
      rating: review.rating,
      comment: review.comment,
    });
    setIsEditModalOpen(true);
  };

  // Submit cập nhật đánh giá
  const handleUpdateReviewSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      const response = await API.put(`/api/customer/reviews/${editingReviewId}`, values);
      if (response.data.success) {
        message.success('Đã cập nhật thay đổi đánh giá!');
        setReviews(reviews.map(r => r._id === editingReviewId ? { ...r, ...values } : r));
        setIsEditModalOpen(false);
      }
    } catch (error) {
      message.error('Không thể cập nhật đánh giá, vui lòng thử lại.');
    }
  };

  // Khách hàng tự xóa đánh giá
  const handleDeleteReview = async (reviewId) => {
    try {
      const response = await API.delete(`/api/customer/reviews/${reviewId}`);
      if (response.data.success) {
        message.success('Đã xóa đánh giá thành công!');
        setReviews(reviews.filter(r => r._id !== reviewId));
      }
    } catch (error) {
      message.error('Lỗi khi xóa đánh giá của bạn.');
    }
  };

  // Gửi bình luận trao đổi qua lại (Discussion)
  const handleSendDiscussion = async (reviewId) => {
    const text = replyInputs[reviewId];
    if (!text || !text.trim()) return;
    if (!currentUser) {
      message.warning('Vui lòng đăng nhập để tham gia trao đổi thảo luận!');
      return;
    }

    try {
      const response = await API.post(`/api/reviews/${reviewId}/discussion`, { comment: text });
      if (response.data.success) {
        message.success('Đã gửi phản hồi thảo luận công khai!');
        // Cập nhật dữ liệu tức thì trên UI
        setReviews(reviews.map(r => r._id === reviewId ? response.data.review : r));
        setReplyInputs({ ...replyInputs, [reviewId]: '' }); // Clear ô nhập
      }
    } catch (error) {
      message.error('Không thể gửi phản hồi thảo luận');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" tip="Đang tải..." /></div>;
  if (!product) return <div style={{ textAlign: 'center', padding: '50px' }}><Text type="secondary">Sản phẩm không tồn tại.</Text></div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', marginTop: 20 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>Quay lại</Button>
      
      {/* KHỐI SẢN PHẨM */}
      <Card style={{ marginBottom: 24 }} className="shadow-sm">
        <Row gutter={[40, 32]}>
          <Col xs={24} md={12} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: '100%', minHeight: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 12, overflow: 'hidden' }}>
                <img
                  src={productImages[activeImageIndex] || getImageUrl(product.image, 'https://via.placeholder.com/350')}
                  alt={product.name}
                  style={{ width: '100%', maxHeight: 350, objectFit: 'contain', padding: 12 }}
                />
              </div>

              {productImages.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  {productImages.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      style={{
                        width: 68,
                        height: 68,
                        padding: 4,
                        borderRadius: 10,
                        border: index === activeImageIndex ? '2px solid #1677ff' : '1px solid #d9d9d9',
                        background: '#fff',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        boxShadow: index === activeImageIndex ? '0 4px 12px rgba(22, 119, 255, 0.15)' : 'none',
                      }}
                      aria-label={`Xem ảnh ${index + 1}`}
                    >
                      <img
                        src={imageUrl}
                        alt={`${product.name} ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Space style={{ marginBottom: 10 }}><Tag color="blue">{product.brand}</Tag><Tag color="green">{product.category}</Tag></Space>
            <Title level={2}>{product.name}</Title>
            <div style={{ background: '#fafafa', padding: '10px 15px', borderRadius: 8, marginBottom: 20 }}>
              <Text type="danger" style={{ fontSize: 24, fontWeight: 'bold' }}>{product.price?.toLocaleString()} VNĐ</Text>
            </div>
            <Paragraph><Text strong>Mô tả:</Text> <div>{product.description}</div></Paragraph>
            <div style={{ marginBottom: 20 }}>
              <Text strong>Số lượng: </Text>
              <InputNumber min={1} max={product.stock || 1} value={quantity} onChange={(val) => setQuantity(val || 1)} style={{ width: 70 }} />
              <Text type="secondary"> (Kho còn: {product.stock})</Text>
            </div>
            <Space>
              <Button type="default" icon={<ShoppingCartOutlined />} onClick={() => handleAddToCart(true)}>Thêm vào giỏ</Button>
              <Button type="primary" danger icon={<ThunderboltOutlined />} onClick={handleBuyNow}>Mua ngay</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KHỐI ĐÁNH GIÁ & TRAO ĐỔI QUA LẠI */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card id="reviews-section" title={<Space><MessageOutlined /> <Text strong>Đánh giá & Thảo luận ({reviews.length})</Text></Space>}>
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><Text type="secondary">Chưa có đánh giá nào.</Text></div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={reviews}
                renderItem={(item) => (
                  <List.Item style={{ padding: '20px 0', alignItems: 'flex-start', display: 'block' }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <Avatar size={isMobile ? 30 : 56} icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <Space direction="vertical" size={0}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Text strong style={{ fontSize: isMobile ? 14 : 16 }}>{item.name}</Text>
                                    </div>
                                  </Space>
                                  <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text>
                                </div>
                                <Rate disabled defaultValue={item.rating} style={{ fontSize: isMobile ? 14 : 11, display: 'block', margin: '6px 0' }} />
                                <p style={{ color: '#262626', margin: isMobile ? '8px 0' : '6px 0', fontSize: isMobile ? 14 : 14 }}>{item.comment}</p>

                        {/* Thanh công cụ hành động: Sửa / Xóa đánh giá dành riêng cho chủ nhân bài viết */}
                        {item.userId === currentUser?.id && (
                          <Space size="middle" style={{ marginTop: 4, marginBottom: 8 }}>
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditReview(item)}>Sửa đánh giá</Button>
                            <Popconfirm title="Xóa đánh giá này?" onConfirm={() => handleDeleteReview(item._id)} okText="Xóa" cancelText="Hủy">
                              <Button type="link" size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                            </Popconfirm>
                          </Space>
                        )}

                        {/* Chuỗi Lịch sử các trao đổi thảo luận con (Discussions) */}
                        {item.discussions && item.discussions.length > 0 && (
                          <div style={{ background: '#f9f9f9', padding: isMobile ? '8px' : '10px 12px', borderRadius: 6, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {item.discussions.map((disc, idx) => (
                              <div key={idx} style={{ borderBottom: idx !== item.discussions.length - 1 ? '1px dashed #e8e8e8' : 'none', paddingBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <Text strong style={{ fontSize: isMobile ? 13 : 12 }}>{disc.name}</Text>
                                    <div style={{ marginTop: 4 }}>
                                      <Tag color={disc.role === 'admin' ? 'red' : 'blue'} style={{ fontSize: isMobile ? 11 : 10 }}>{disc.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}</Tag>
                                    </div>
                                  </div>
                                  <Text type="secondary" style={{ fontSize: isMobile ? 11 : 10 }}>{new Date(disc.createdAt).toLocaleDateString('vi-VN')}</Text>
                                </div>
                                <p style={{ margin: '6px 0 0 0', color: '#434343', fontSize: isMobile ? 14 : 13 }}>{disc.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Khung phản hồi trao đổi tức thì công khai */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexDirection: isMobile ? 'column' : 'row' }}>
                          <Input 
                            placeholder={currentUser ? "Nhập câu hỏi, câu trả lời hoặc thảo luận trao đổi..." : "Vui lòng đăng nhập để phản hồi..."}
                            disabled={!currentUser}
                            size="small"
                            value={replyInputs[item._id] || ''}
                            onChange={(e) => setReplyInputs({ ...replyInputs, [item._id]: e.target.value })}
                            onPressEnter={() => handleSendDiscussion(item._id)}
                            style={{ width: isMobile ? '100%' : 'auto' }}
                          />
                          <Button disabled={!currentUser} size="small" type="primary" icon={<CommentOutlined />} onClick={() => handleSendDiscussion(item._id)} block={isMobile}>Gửi</Button>
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* BÊN PHẢI: FORM GỬI REVIEW MỚI */}
        <Col xs={24} lg={10}>
          <Card title={<Text strong>Viết đánh giá của bạn</Text>}>
            {currentUser ? (
              <Form form={form} layout="vertical" onFinish={onFinishReview}>
                <Form.Item name="rating" label="Số sao đánh giá" rules={[{ required: true }]} initialValue={5}>
                  <Rate className="text-amber-400" />
                </Form.Item>
                <Form.Item name="comment" label="Cảm nhận sản phẩm" rules={[{ required: true, message: 'Nhập nội dung bình luận!' }]}>
                  <TextArea rows={4} placeholder="Sản phẩm dùng tốt, đóng gói cẩn thận..." />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={submitting} block>Gửi đánh giá sản phẩm</Button>
              </Form>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text type="secondary">Bạn cần đăng nhập để viết đánh giá cho sản phẩm.</Text>
                <br /><br />
                <Button type="primary" onClick={() => navigate('/login')}>Đi tới đăng nhập</Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* COMPONENT MODAL: PHỤC VỤ SỬA REVIEW */}
      <Modal title="Chỉnh sửa đánh giá của bạn" open={isEditModalOpen} onOk={handleUpdateReviewSubmit} onCancel={() => setIsEditModalOpen(false)} okText="Lưu thay đổi" cancelText="Hủy">
        <Form form={editForm} layout="vertical">
          <Form.Item name="rating" label="Thay đổi số sao đánh giá" rules={[{ required: true }]}>
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="Nội dung đánh giá mới" rules={[{ required: true, message: 'Nội dung không được trống!' }]}>
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductDetail;