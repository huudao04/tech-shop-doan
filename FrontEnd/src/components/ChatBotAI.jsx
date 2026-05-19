import React, { useState, useRef, useEffect } from 'react';
import { FloatButton, Popover, Input, Button, Typography, Card, Tag } from 'antd';
import { RobotOutlined, SendOutlined, EllipsisOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '../utils/axiosClient';

const { Text } = Typography;

const ChatAI = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Chào bạn! Tech-Shop có thể giúp gì cho bạn hôm nay?' }
  ]);
  const scrollRef = useRef(null);

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
      const response = await API.post('/api/chat', {
        message: currentMsg,
        history: messages
      });

      const data = response.data;
      // data.content là trường dữ liệu trả về từ server.js
      const aiMsg = { role: 'ai', content: data.content || "Xin lỗi, tôi gặp trục trặc một chút." };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Lỗi kết nối Backend:', error);
      setMessages(prev => [...prev, { role: 'ai', content: 'Không thể kết nối tới máy chủ AI!' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Render nội dung tin nhắn (Giữ nguyên logic render Card sản phẩm nếu AI nhắc tên)
  const renderMessageContent = (content) => {
    return <Text>{content}</Text>;
  };

  const content = (
    <div style={{ width: 350, height: 450, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Text strong><RobotOutlined /> Trợ lý Tech-Shop AI</Text>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 10, background: '#f9f9f9' }}>
        {messages.map((item, index) => (
          <div key={index} style={{ textAlign: item.role === 'user' ? 'right' : 'left', marginBottom: 15 }}>
            <div style={{ 
              display: 'inline-block', padding: 12, borderRadius: 12,
              background: item.role === 'user' ? '#1677ff' : '#fff',
              color: item.role === 'user' ? '#fff' : '#000',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              maxWidth: '85%'
            }}>
              {renderMessageContent(item.content)}
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