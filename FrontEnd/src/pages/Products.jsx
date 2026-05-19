import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Typography, Slider, Checkbox, Space, Empty, Spin, message } from 'antd';
import { ShoppingCartOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import API from '../utils/axiosClient';
import { useCart } from '../context/CartContex.jsx';

const { Title, Text } = Typography;

const Products = () => {
  const { cartItems, updateCart } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // States phục vụ bộ lọc
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 50000000]); // Mặc định từ 0đ đến 50 triệu
  const [brandsList, setBrandsList] = useState([]);

  // 1. Gọi API lấy danh sách sản phẩm từ Backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await API.get('/api/products');
        setProducts(response.data);

        // Tự động gom nhóm các Hãng (Brand) duy nhất có trong DB để làm danh sách checkbox bộ lọc
        const uniqueBrands = [...new Set(response.data.map(p => p.brand).filter(Boolean))];
        setBrandsList(uniqueBrands);
      } catch (error) {
        console.error("Lỗi lấy sản phẩm:", error);
        message.error("Không thể kết nối dữ liệu sản phẩm từ máy chủ!");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // 2. Hàm xử lý thêm nhanh sản phẩm vào giỏ hàng (Tích hợp Context)
  const handleAddToCart = (product) => {
    const existingItem = cartItems.find(item => item.id === product._id);
    let newCart;

    if (existingItem) {
      newCart = cartItems.map(item =>
        item.id === product._id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...cartItems, {
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1
      }];
    }
    updateCart(newCart);
    message.success(`🛒 Đã thêm "${product.name}" vào giỏ hàng thành công!`);
  };

  // 3. Logic Lọc sản phẩm ở Frontend (Real-time Filter)
  const filteredProducts = products.filter(product => {
    // Lọc theo thương hiệu (Nếu không chọn cái nào thì mặc định lấy tất cả)
    const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(product.brand);
    // Lọc theo khoảng giá tiền
    const matchPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

    return matchBrand && matchPrice;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Đang tải danh sách sản phẩm..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '10px 0' }}>
      <Row gutter={[24, 24]}>
        
        {/* CỘT TRÁI: THANH BỘ LỌC (FILTER SIDEBAR) */}
        <Col xs={24} md={6}>
          <Card title={<Space><FilterOutlined /> Bộ lọc tìm kiếm</Space>} style={{ borderRadius: 8}}>
            
            {/* Lọc theo Hãng */}
            <div style={{ marginBottom: 25 }}>
              <Text strong style={{ display: 'block', marginBottom: 10 }}>Thương hiệu</Text>
              {brandsList.length === 0 ? <Text type="secondary">Không có dữ liệu</Text> : (
                <Checkbox.Group 
                  options={brandsList} 
                  value={selectedBrands} 
                  onChange={(checkedValues) => setSelectedBrands(checkedValues)}
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                />
              )}
            </div>

            {/* Lọc theo Giá tiền */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text strong>Khoảng giá (VNĐ)</Text>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => { setSelectedBrands([]); setPriceRange([0, 50000000]); }}
                  style={{ padding: 0 }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
              <Slider
                range
                min={0}
                max={50000000}
                step={500000}
                value={priceRange}
                onChange={(value) => setPriceRange(value)}
                tooltip={{ formatter: (val) => `${val.toLocaleString()}đ` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{priceRange[0].toLocaleString()}đ</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{priceRange[1].toLocaleString()}đ</Text>
              </div>
            </div>

          </Card>
        </Col>

        {/* CỘT PHẢI: DANH SÁCH SẢN PHẨM */}
        <Col xs={24} md={18}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Title level={3} style={{ margin: 0 }}>Tất cả sản phẩm</Title>
            <Text type="secondary">Tìm thấy <b>{filteredProducts.length}</b> sản phẩm</Text>
          </div>

          {filteredProducts.length === 0 ? (
            <Card style={{ borderRadius: 8, padding: '40px 0' }}>
              <Empty description="Không tìm thấy sản phẩm nào khớp với bộ lọc của bạn!" />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {filteredProducts.map(product => (
                <Col xs={24} sm={12} lg={8} key={product._id}>
                  <Card
                    hoverable
                    style={{ borderRadius: 8, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
                    bodyStyle={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    cover={
                      <div style={{ background: '#fcfcfc', padding: '20px', textAlign: 'center', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          alt={product.name}
                          src={`/images/${product.image}`}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/200'; }}
                        />
                      </div>
                    }
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>{product.brand || 'Tech-Shop'}</Text>
                      <Title level={5} style={{ margin: '4px 0 8px 0', height: '44px', overflow: 'hidden', display: '-webkit-box', WebkitLineBreak: 'anywhere', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {product.name}
                      </Title>
                      <div style={{ marginBottom: 12 }}>
                        <Text type="danger" strong style={{ fontSize: 16 }}>
                          {product.price.toLocaleString()} VNĐ
                        </Text>
                        {product.stock <= 0 && (
                          <span style={{ marginLeft: 8, color: '#f5222d', fontSize: 12, background: '#fff1f0', padding: '2px 6px', borderRadius: 4 }}>Hết hàng</span>
                        )}
                      </div>
                    </div>

                    <Space size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Link to={`/product/${product._id}`}>
                        <Button icon={<EyeOutlined />}>Chi tiết</Button>
                      </Link>
                      <Button 
                        type="primary" 
                        icon={<ShoppingCartOutlined />} 
                        disabled={product.stock <= 0}
                        onClick={() => handleAddToCart(product)}
                      >
                        Thêm giỏ
                    </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Col>

      </Row>
    </div>
  );
};

export default Products;