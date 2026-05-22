import React, { useState, useEffect } from 'react';
import { Row, Col, Typography } from 'antd';
import ProductCard from '../components/ProductCard';
import API from '../utils/axiosClient';
const { Title } = Typography;

const Home = () => {

  const [products, setProducts] = useState([]);
  useEffect(() => {
  API.get('/api/products').then(res => setProducts(res.data));
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2} style={{ marginBottom: '30px', textAlign: 'center' }}>
        Sản Phẩm Mới Nhất
      </Title>
      
      <Row gutter={[24, 24]}>
        {products.map((product) => (
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
  );
};

export default Home;