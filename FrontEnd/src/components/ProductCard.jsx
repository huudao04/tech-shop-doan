import React from 'react';
import { Card, Button, Typography, Space, message } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContex.jsx';

const { Text, Title } = Typography;

const ProductCard = ({ name, price, image, category, id }) => {
  const { cartItems, updateCart } = useCart();
  const navigate = useNavigate();

  const handleAddToCart = (e) => {
    // Ngăn chặn sự kiện click lan ra ngoài (không bị nhảy vào Link trang chi tiết)
    e.stopPropagation();
    e.preventDefault();

    const existingItem = cartItems.find(item => item.id === id);
    let newCart;

    if (existingItem) {
      newCart = cartItems.map(item =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...cartItems, { id, name, price, image, quantity: 1 }];
    }

    updateCart(newCart);
    message.success(`Đã thêm ${name} vào giỏ hàng!`);
  };

  return (
    <Card
      hoverable
      onClick={() => navigate(`/product/${id}`)}
      style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}
      cover={
        <div style={{
          height: 200,  
          display: 'flex',     
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '10px',
          overflow: 'hidden'
        }}>
          <img 
            alt={name} 
            src={`/images/${image}`} 
            style={{ 
              maxHeight: '100%',  
              maxWidth: '100%',  
              objectFit: 'contain' 
            }} 
            onError={(e) => { e.target.src = 'https://via.placeholder.com/200'; }}
          />
        </div>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>{category}</Text>
        <Title level={5} ellipsis={{ rows: 1 }} style={{ margin: 0, height: '24px' }}>
          {name}
        </Title>
        <Text type="danger" strong style={{ fontSize: '18px' }}>
          {price?.toLocaleString()} VNĐ
        </Text>
        <Button 
          type="primary" 
          icon={<ShoppingCartOutlined />} 
          block 
          style={{ marginTop: '10px', borderRadius: '6px' }}
          onClick={handleAddToCart}
        >
          Thêm vào giỏ
        </Button>
      </Space>
    </Card>
  );
};

export default ProductCard;