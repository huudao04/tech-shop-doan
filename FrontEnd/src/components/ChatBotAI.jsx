import { useState, useRef, useEffect } from 'react';
import { FloatButton, Popover, Input, Button, Typography, Card, Tag, message } from 'antd';
import { RobotOutlined, SendOutlined, EllipsisOutlined, ShoppingOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '../utils/axiosClient';
import { getImageUrl } from '../utils/imageUrl.js';

const { Text } = Typography;

const DEFAULT_MESSAGES = [
  { role: 'ai', content: 'Chào bạn! Tech-Shop có thể giúp gì cho bạn hôm nay?' }
];

const ChatAI = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('techshop_chat_session_id') || '');
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const scrollRef = useRef(null);
  const hasChatHistory = messages.length > DEFAULT_MESSAGES.length;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const currentMsg = inputValue;
    const userMsg = { role: 'user', content: currentMsg };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await API.post('/api/chat/ask', {
        message: currentMsg,
        history: messages,
        sessionId
      });

      const data = response.data;
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('techshop_chat_session_id', data.sessionId);
      }
      const aiMsg = {
        role: 'ai',
        content: data.content || 'Xin lỗi, tôi gặp trục trặc một chút.',
        action: data.action || 'text',
        products: Array.isArray(data.products) ? data.products : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        targetUrl: data.targetUrl || ''
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Lỗi kết nối Backend:', error);
      setMessages(prev => [...prev, { role: 'ai', content: 'Không thể kết nối tới máy chủ AI!' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await API.delete('/api/chat/clear', {
        data: sessionId ? { sessionId } : {}
      });
      message.success('Đã xóa lịch sử hội thoại.');
    } catch (error) {
      message.success('Đã xóa hội thoại trên giao diện.');
      console.error('Lỗi xóa lịch sử chat:', error);
    } finally {
      setMessages(DEFAULT_MESSAGES);
      setInputValue('');
      setIsTyping(false);
      setSessionId('');
      localStorage.removeItem('techshop_chat_session_id');
    }
  };

  const renderProductCard = (product) => {
    const imageUrl = getImageUrl(product.image);

    return (
      <Card
        key={product._id}
        size="small"
        hoverable
        onClick={() => navigate(`/product/${product._id}`)}
        style={{ marginTop: 8, cursor: 'pointer', borderRadius: 12, overflow: 'hidden' }}
        cover={imageUrl ? <img src={imageUrl} alt={product.name} style={{ height: 120, objectFit: 'cover' }} /> : null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Text strong style={{ lineHeight: 1.3 }}>{product.name}</Text>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {product.brand && <Tag color="blue">{product.brand}</Tag>}
            {product.category && <Tag color="green">{product.category}</Tag>}
          </div>
          <Text type="danger" strong>{Number(product.price || 0).toLocaleString()} VNĐ</Text>
          <Button
            size="small"
            type="primary"
            icon={<ShoppingOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/product/${product._id}`);
            }}
          >
            Xem chi tiết
          </Button>
        </div>
      </Card>
    );
  };

  const renderOrderCard = (order) => {
    return (
      <Card
        key={order._id || order.orderId}
        size="small"
        hoverable
        onClick={() => navigate(order.detailUrl || '/my-orders')}
        style={{ marginTop: 8, cursor: 'pointer', borderRadius: 12 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined />
            <Text strong>{order.orderId}</Text>
          </div>
          <Text type="secondary">Trạng thái: {order.status}</Text>
          <Text type="secondary">Thanh toán: {order.paymentStatus}</Text>
          <Text strong>{Number(order.totalPrice || 0).toLocaleString()} VNĐ</Text>
          <Button
            size="small"
            type="primary"
            onClick={(event) => {
              event.stopPropagation();
              navigate(order.detailUrl || '/my-orders');
            }}
          >
            Mở màn đơn hàng
          </Button>
        </div>
      </Card>
    );
  };

  // Render nội dung tin nhắn dạng text hoặc card theo dữ liệu trả về từ backend
  const renderMessageContent = (item) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Text>{item.content}</Text>

        {item.action === 'product-results' && item.products?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.products.map(renderProductCard)}
          </div>
        )}

        {item.action === 'order-results' && item.orders?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.orders.map(renderOrderCard)}
          </div>
        )}

        {item.action === 'order-login-required' && item.targetUrl && (
          <Button type="primary" size="small" onClick={() => navigate(item.targetUrl)}>
            Đăng nhập để tra cứu đơn hàng
          </Button>
        )}
      </div>
    );
  };

  const content = (
    <div style={{ width: 350, height: 450, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text strong><RobotOutlined /> Trợ lý Tech-Shop AI</Text>
          {hasChatHistory && (
            <Button style={{ color: '#ff4d4f', border: '1px solid #ff4d4f' }} onClick={handleClearHistory}>
              Xóa lịch sử
            </Button>
          )}
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 10, background: '#f9f9f9' }}>
        {messages.map((item, index) => (
          <div key={index} style={{ textAlign: item.role === 'user' ? 'right' : 'left', marginBottom: 15 }}>
            <div style={{ 
              display: 'inline-block', padding: 12, borderRadius: 12,
              background: '#fff',
              color: item.role === 'user' ? '#fff' : '#000',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              maxWidth: '85%'
            }}>
              {renderMessageContent(item)}
            </div>
          </div>
        ))}
        {isTyping && <EllipsisOutlined style={{ fontSize: 24, marginLeft: 10 }} />}
      </div>
      <div style={{ padding: 10, display: 'flex', gap: 8 }}>
        <Input 
          value={inputValue} 
          onChange={e => setInputValue(e.target.value)} 
          onPressEnter={handleSend}
          placeholder="Hỏi về sản phẩm..." 
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} />
      </div>
    </div>
  );

  return (
    <>
      <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="topLeft">
        <FloatButton icon={<RobotOutlined />} type="primary" style={{ right: 24, bottom: 24, width: 60, height: 60 }} />
      </Popover>
    </>
  );
};

export default ChatAI;