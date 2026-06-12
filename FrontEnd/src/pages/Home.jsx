import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Typography, Carousel, Card, Avatar, Space, Tabs, Badge, Tag } from 'antd';
import { 
  RocketOutlined, 
  SafetyCertificateOutlined, 
  CustomerServiceOutlined, 
  FireOutlined, 
  AppstoreOutlined, 
  GiftOutlined,
  LaptopOutlined,
  MobileOutlined,
  TabletOutlined,
  ToolOutlined,
  DesktopOutlined,
  AppstoreAddOutlined 
} from '@ant-design/icons';
import ProductCard from '../components/ProductCard';
import {useNavigate} from 'react-router-dom';
import API from '../utils/axiosClient';

const { Title, Text } = Typography;

const BannerCarousel = () => {
  const carouselRef = useRef(null);
  const [index, setIndex] = useState(0);

  const banners = [
    '/images/Gemini_Generated_Image_mrf1hcmrf1hcmrf1.png',
    '/images/Gemini_Generated_Image_mrf1hcmrf1hcmrf1 (1).png',
    '/images/Gemini_Generated_Image_4fsj854fsj854fsj.png',
    '/images/Gemini_Generated_Image_4fsj854fsj854fsj (1).png'
  ];

  return (
    <div style={{ width: '100%', overflow: 'visible', position: 'relative' }}>
      <Carousel
        ref={carouselRef}
        autoplay
        autoplaySpeed={10000}
        afterChange={(i) => setIndex(i)}
        effect="fade"
        dots={false}
        style={{ width: '80%', margin: '0 auto', borderRadius: '0', overflow: 'hidden' }}
      >
        {banners.map((src, i) => (
          <div key={i}>
              <img
                src={src}
                alt={`banner-${i}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
          </div>
        ))}
      </Carousel>

      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -16, display: 'flex', justifyContent: 'center', gap: 10, zIndex: 20 }}>
        {banners.map((_, i) => (
          <div
            key={i}
            onClick={() => carouselRef.current && carouselRef.current.goTo(i)}
            style={{
              width: 48,
              height: 8,
              borderRadius: 6,
              cursor: 'pointer',
              background: index === i ? '#1677ff' : '#d9d9d9',
              boxShadow: index === i ? '0 4px 12px rgba(22,119,255,0.12)' : 'none',
              transition: 'all 0.25s'
            }}
          />
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [hotDeals, setHotDeals] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
  API.get('/api/products?sort=sold&limit=4').then(res => setHotDeals(res.data.products || []));
  API.get('/api/products?sort=newest&limit=4').then(res => setNewArrivals(res.data.products || []));
  API.get('/api/products').then(res => setProducts(res.data.products || []));
  API.get('/api/categories').then(res => setCategories(res.data));
  API.get('/api/brands').then(res => setBrands(res.data));
}, []);

  const getCategoryIcon = (slug = '', name = '') => {
    const value = `${slug} ${name}`.toLowerCase();

    if (value.includes('laptop') || value.includes('máy tính xách tay') || value.includes('may tinh xach tay')) {
      return <LaptopOutlined />;
    }

    if (
      value.includes('tablet') ||
      value.includes('may tinh bang') ||
      value.includes('máy tính bảng')
    ) {
      return <TabletOutlined />;
    }

    if (
      value.includes('phone') ||
      value.includes('smartphone') ||
      value.includes('dien-thoai') ||
      value.includes('điện thoại')
    ) {
      return <MobileOutlined />;
    }

    if (
      value.includes('accessories') ||
      value.includes('phu kien') ||
      value.includes('phụ kiện') ||
      value.includes('phukien')
    ) {
      return <ToolOutlined />;
    }

    if (
      value.includes('desktop') ||
      value.includes('pc') ||
      value.includes('may tinh') ||
      value.includes('máy tính')
    ) {
      return <DesktopOutlined />;
    }

    return <AppstoreAddOutlined />;
  };

  return (
    <div style={{ backgroundColor: '#f5f7fa', paddingBottom: '50px' }}>

      <div style={{ marginBottom: '40px' }}>
        <BannerCarousel />
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
                    <div style={{ fontSize: '32px', marginBottom: '8px', color: '#1677ff' }}>
                      {getCategoryIcon(cat.slug, cat.name)}
                    </div>
                    <Text strong style={{ display: 'block', textTransform: 'capitalize' }}>{cat.name}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {/* 4. SECTION SẢN PHẨM KHUYẾN MÃI / BÁN CHẠY (TABS MIX) */}
        <div 
          style={{ 
            background: '#fff', 
            padding: '24px', 
            borderRadius: '12px', 
            marginBottom: '40px', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
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
        
        <div style={{ marginTop: '40px' }} className="all-products-carousel">
          <Title level={3} style={{ marginBottom: '24px' }}>SẢN PHẨM</Title>
          
          {(() => {
            const chunkProducts = (arr, size) => {
              return arr.reduce((acc, _, i) => (i % size === 0 ? [...acc, arr.slice(i, i + size)] : acc), []);
            };

            const productGroups = chunkProducts(products || [], 8);

            if (productGroups.length === 0) {
              return <div style={{ textAlign: 'center', color: '#999' }}>Chưa có sản phẩm nào.</div>;
            }

            return (
              <Carousel 
                dots={true}  
                infinite={false} 
                speed={600}     
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
                  color="green" 
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
