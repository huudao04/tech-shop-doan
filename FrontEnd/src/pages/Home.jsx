import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Carousel, Card, Avatar, Space, Tabs, Badge, Tag } from 'antd';
import { 
  RocketOutlined, 
  SafetyCertificateOutlined, 
  CustomerServiceOutlined, 
  FireOutlined, 
  AppstoreOutlined, 
  GiftOutlined 
} from '@ant-design/icons';
import ProductCard from '../components/ProductCard';
import {useNavigate} from 'react-router-dom';
import API from '../utils/axiosClient';

const { Title, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [hotDeals, setHotDeals] = useState([]);       
  const [newArrivals, setNewArrivals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    // Tải đồng thời Sản phẩm, Danh mục và Thương hiệu từ API server.js
    API.get('/api/products?sort=sold&limit=4').then(res => setHotDeals(res.data));
    API.get('/api/products?sort=newest&limit=4').then(res => setNewArrivals(res.data));
    API.get('/api/products').then(res => setProducts(res.data));
    API.get('/api/categories').then(res => setCategories(res.data));
    API.get('/api/brands').then(res => setBrands(res.data));
  }, []);

  // Danh mục icons hỗ trợ hiển thị đẹp mắt cho Tech-shop
  const getCategoryIcon = (slug) => {
    switch (slug) {
      case 'laptop': return '💻';
      case 'phone': case 'dien-thoai': return '📱';
      case 'keyboard': case 'ban-phim': return '⌨️';
      case 'mouse': case 'chuot': return '🖱️';
      case 'headphone': case 'tai-nghe': return '🎧';
      default: return '🎮';
    }
  };

  return (
    <div style={{ backgroundColor: '#f5f7fa', paddingBottom: '50px' }}>
      
      {/* 1. SECTION BANNER SLIDER (CAROUSEL) */}
      <div style={{ marginBottom: '40px', background: '#fff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '15px 0' }}>
          <Carousel autoplay effect="fade" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div>
              <div style={{ 
                height: '380px', 
                background: 'linear-gradient(135deg, #111 0%, #333 100%)', 
                color: '#fff', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                padding: '0 60px' 
              }}>
                <Tag color="red" style={{ width: 'fit-content', marginBottom: '15px' }}>BIG SALE 2026</Tag>
                <Title level={1} style={{ color: '#fff', margin: 0, fontSize: '38px' }}>SIÊU PHẨM CÔNG NGHỆ MỚI</Title>
                <Text style={{ color: '#aaa', fontSize: '18px', marginTop: '10px' }}>Giảm giá lên đến 30% cho toàn bộ phụ kiện Gaming Gear cao cấp.</Text>
              </div>
            </div>
            <div>
              <div style={{ 
                height: '380px', 
                background: 'linear-gradient(135deg, #1677ff 0%, #003a8c 100%)', 
                color: '#fff', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                padding: '0 60px' 
              }}>
                <Tag color="gold" style={{ width: 'fit-content', marginBottom: '15px' }}>HOT TREND</Tag>
                <Title level={1} style={{ color: '#fff', margin: 0, fontSize: '38px' }}>LAPTOP WORKSTATION THẾ HỆ MỚI</Title>
                <Text style={{ color: '#e6f7ff', fontSize: '18px', marginTop: '10px' }}>Trả góp 0% lãi suất - Tặng kèm gói bảo hành vàng 2 năm.</Text>
              </div>
            </div>
          </Carousel>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 15px' }}>
        
        {/* 2. SECTION CAM KẾT DỊCH VỤ (SHOPPING ADVANTAGES) */}
        <Row gutter={[16, 16]} style={{ marginBottom: '40px' }}>
          <Col xs={24} md={8}>
            <Card bordered={false} style={{ textAlign: 'center', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Space direction="vertical" size={12}>
                <Avatar size={54} icon={<RocketOutlined />} style={{ backgroundColor: '#e6f7ff', color: '#1677ff' }} />
                <Text strong style={{ fontSize: '16px' }}>Giao Hàng Siêu Tốc</Text>
                <Text type="secondary">Nội thành giao nhanh trong 2h, miễn phí đơn từ 2 triệu.</Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered={false} style={{ textAlign: 'center', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Space direction="vertical" size={12}>
                <Avatar size={54} icon={<SafetyCertificateOutlined />} style={{ backgroundColor: '#f6ffed', color: '#52c41a' }} />
                <Text strong style={{ fontSize: '16px' }}>Chính Hãng 100%</Text>
                <Text type="secondary">Cam kết hoàn tiền gấp 10 lần nếu phát hiện hàng giả, hàng nhái.</Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered={false} style={{ textAlign: 'center', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Space direction="vertical" size={12}>
                <Avatar size={54} icon={<CustomerServiceOutlined />} style={{ backgroundColor: '#fff7e6', color: '#fa8c16' }} />
                <Text strong style={{ fontSize: '16px' }}>Hỗ Trợ Chuyên Nghiệp</Text>
                <Text type="secondary">Đội ngũ kỹ thuật viên am hiểu công nghệ hỗ trợ 24/7.</Text>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 3. SECTION DANH MỤC NỔI BẬT (QUICK LINKS) */}
        {categories.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <Title level={3} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppstoreOutlined style={{ color: '#1677ff' }} /> Danh Mục Khơi Nguồn Đam Mê
            </Title>
            <Row gutter={[16, 16]}>
              {categories.map((cat) => (
                <Col xs={12} sm={8} md={4} key={cat._id}>
                  <Card 
                    hoverable 
                    bordered={false}
                    bodyStyle={{ padding: '20px 10px', textAlign: 'center' }}
                    style={{ borderRadius: '8px', transition: '0.3s' }}
                    onClick={() => navigate(`/products?category=${encodeURIComponent(cat.name)}`)}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                      {getCategoryIcon(cat.slug)}
                    </div>
                    <Text strong style={{ display: 'block', textTransform: 'capitalize' }}>{cat.name}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {/* 4. SECTION SẢN PHẨM KHUYẾN MÃI / BÁN CHẠY (TABS MIX) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', marginBottom: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <Tabs 
            defaultActiveKey="1"
            size="large"
            items={[
              {
                key: '1',
                label: (
                  <span style={{ fontSize: '18px', fontWeight: '600' }}>
                    <FireOutlined style={{ color: '#ff4d4f' }} /> Săn Deal Bán Chạy
                  </span>
                ),
                children: (
                  <Row gutter={[24, 24]} style={{ marginTop: '10px' }}>
                    {hotDeals.map((product) => (
                      <Col xs={24} sm={12} md={8} lg={6} key={product._id}>
                        <Badge.Ribbon text="Hot Sale" color="red">
                          <ProductCard
                            id={product._id} 
                            name={product.name}
                            price={product.price}
                            image={product.image}
                            category={product.category}
                            brand={product.brand}
                          />
                        </Badge.Ribbon>
                      </Col>
                    ))}
                  </Row>
                ),
              },
              {
                key: '2',
                label: (
                  <span style={{ fontSize: '18px', fontWeight: '600' }}>
                    <GiftOutlined style={{ color: '#52c41a' }} /> Mới Lên Kệ
                  </span>
                ),
                children: (
                  <Row gutter={[24, 24]} style={{ marginTop: '10px' }}>
                    {newArrivals.map((product) => (
                      <Col xs={24} sm={12} md={8} lg={6} key={product._id}>
                        <Badge.Ribbon text="New" color="green">
                          <ProductCard
                            id={product._id} 
                            name={product.name}
                            price={product.price}
                            image={product.image}
                            category={product.category}
                            brand={product.brand}
                          />
                        </Badge.Ribbon>
                      </Col>
                    ))}
                  </Row>
                ),
              }
            ]}
          />
        </div>
        
        {/* 5. SECTION TẤT CẢ SẢN PHẨM (Thiết kế trượt trang dạng Carousel 8 sản phẩm) */}
        <div style={{ marginTop: '40px' }} className="all-products-carousel">
          <Title level={3} style={{ marginBottom: '24px' }}>Tất Cả Sản Phẩm Công Nghệ</Title>
          
          {(() => {
            // Hàm chia nhỏ mảng sản phẩm, mỗi nhóm chứa tối đa 8 sản phẩm
            const chunkProducts = (arr, size) => {
              return arr.reduce((acc, _, i) => (i % size === 0 ? [...acc, arr.slice(i, i + size)] : acc), []);
            };

            const productGroups = chunkProducts(products || [], 8);

            if (productGroups.length === 0) {
              return <div style={{ textAlign: 'center', color: '#999' }}>Chưa có sản phẩm nào.</div>;
            }

            return (
              <Carousel 
                dots={true}       // Hiện các thanh gạch ngang chuyển trang dưới chân slide
                infinite={false}  // Không lặp vòng vô tận khi lướt hết sản phẩm
                speed={600}       // Tốc độ trượt mượt mà (ms)
              >
                {productGroups.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {/* Mỗi nhóm 8 sản phẩm nằm gọn trong một grid Row, tự xuống hàng sau 4 sản phẩm */}
                    <Row gutter={[24, 24]} style={{ margin: 0, paddingBottom: '20px' }}>
                      {group.map((product) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={product._id}>
                          <ProductCard
                            id={product._id} 
                            name={product.name}
                            price={product.price}
                            image={product.image}
                            category={product.category}
                            brand={product.brand}
                          />
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </Carousel>
            );
          })()}

          {/* Ghi đè CSS CSS-in-JS để biến dấu tròn chấm mặc định thành thanh gạch ngang dẹt giống mẫu */}
          <style>{`
            .all-products-carousel .ant-carousel .slick-dots {
              position: relative;
              bottom: -10px;
              margin-top: 25px;
            }
            .all-products-carousel .ant-carousel .slick-dots li button {
              background: #bfbfbf;
              height: 4px;
              border-radius: 2px;
              transition: all 0.3s;
            }
            .all-products-carousel .ant-carousel .slick-dots li.slick-active button {
              background: #1677ff; /* Đổi sang màu xanh thương hiệu khi đang chọn trang đó */
              width: 24px;
            }
          `}</style>
        </div>

        {/* 6. SECTION THƯƠNG HIỆU ĐỒNG HÀNH */}
        {brands.length > 0 && (
          <div style={{ marginTop: '50px', textAlign: 'center' }}>
            <Title level={4} type="secondary" style={{ marginBottom: '25px', fontWeight: 'normal' }}>
              Đối Tác Phân Phối Chính Hãng Đáng Tin Cậy
            </Title>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', opacity: 0.6 }}>
              {brands.map((brand) => (
                <Tag 
                  key={brand._id} 
                  color="blue" 
                  style={{ 
                    padding: '8px 20px', 
                    fontSize: '15px', 
                    fontWeight: 'bold', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/products?brand=${encodeURIComponent(brand.name)}`)}
                >
                  {brand.name.toUpperCase()}
                </Tag>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Home;