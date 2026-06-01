import { useState, useEffect } from 'react'; 
import { 
  Layout, Menu, Input, Badge, Dropdown, Avatar, notification, 
  Space, AutoComplete, Row, Col, List
} from 'antd';
import { 
  ProfileOutlined, ShoppingOutlined, SettingOutlined, LogoutOutlined, 
  ShoppingCartOutlined, UserOutlined, SearchOutlined,
  FacebookOutlined, YoutubeOutlined, InstagramOutlined, GlobalOutlined
} from '@ant-design/icons';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import ChatAI from '../components/ChatBotAI.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import { useCart } from '../context/CartContex.jsx';
import API from '../utils/axiosClient';
import { io } from 'socket.io-client';
import { getImageUrl } from '../utils/imageUrl.js';

const { Header, Content, Footer } = Layout;

const UserLayout = () => {
  const { totalCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchOptions, setSearchOptions] = useState([]);

  // Đọc thông tin người dùng từ localStorage
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const policyData = [
    { text: 'Chính sách bảo hành', link: '/policy/warranty' },
    { text: 'Chính sách đổi trả 1-1', link: '/policy/return' },
    { text: 'Chính sách giao hàng tận nơi', link: '/policy/shipping' },
    { text: 'Bảo mật thông tin khách hàng', link: '/policy/privacy' },
  ];

  const serviceData = [
    { text: 'Dịch vụ sửa chữa phần cứng', link: '/services/repair' },
    { text: 'Trả góp ưu đãi 0%', link: '/services/installment' },
    { text: 'Tin tức công nghệ mới nhất', link: '/news' },
    { text: 'Liên hệ hợp tác kinh doanh', link: '/contact' },
  ];

  const supportData = [
    { text: 'Hotline: 1900 1234', link: '/support/how-to-buy' },
    { text: 'Email: support@techshop.com', link: '/support/faq' },
    { text: 'Hướng dẫn mua hàng', link: '/support/how-to-buy' },
  ]; 

  const getSelectedMenuKey = () => {
    const path = location.pathname;
    if (path === '/' || path === '/home') return ['1'];
    if (path.startsWith('/products') || path.startsWith('/product/')) return ['2'];
    if (path === '/cart') return ['3']; // Ví dụ nếu bạn có tab giỏ hàng trên thanh menu
    return [];
  };
  // Hàm gọi API lấy danh sách gợi ý khi người dùng gõ chữ
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchKeyword.trim().length > 0) {
        try {
          const response = await API.get(`/api/products/search-suggest?q=${encodeURIComponent(searchKeyword)}`);
          
          // ĐỊNH DẠNG: Thêm hình ảnh và bọc khối dữ liệu gọn gàng
          const options = response.data.map(prod => ({
            value: prod.name,
            key: prod._id,
            image: Array.isArray(prod.image) ? prod.image[0] : prod.image,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                {/* Ảnh sản phẩm nhỏ bên trái dropdown */}
                <img 
                  src={getImageUrl(prod.image, 'https://via.placeholder.com/40')} 
                  alt={prod.name}
                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #f0f0f0' }}
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/40'; }} // Fallback nếu lỗi ảnh
                />
                {/* Thông tin Tên và Giá bên phải */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#333' }}>
                    {prod.name}
                  </span>
                  <span style={{ color: '#ff4d4f', fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>
                    {prod.price?.toLocaleString()} VNĐ
                  </span>
                </div>
              </div>
            )
          }));
          setSearchOptions(options);
        } catch (error) {
          console.error("Lỗi lấy dữ liệu gợi ý tìm kiếm:", error);
        }
      } else {
        setSearchOptions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchKeyword]);

  // Hàm xử lý khi người dùng chọn một sản phẩm từ gợi ý
  const handleSelectProduct = (value, option) => {
    setSearchKeyword(value);
    navigate(`/product/${option.key}`);
  };

  // Hàm xử lý khi người dùng nhấn Enter trong ô tìm kiếm
  const handleSearchSubmit = () => {
    if (searchKeyword.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchKeyword.trim())}`);
    }
  };

  useEffect(() => {
    if (!user.id) return;

    const loadNotifications = async () => {
      try {
        const response = await API.get('/api/notifications');
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      } catch (error) {
        console.error('Không thể tải thông báo khách hàng', error);
      }
    };

    const socket = io(import.meta.env.VITE_API_URL );

    // Khách hàng gia nhập phòng theo Role và ID cá nhân để nhận thông báo đích danh
    socket.emit('join_room', { role: 'customer', userId: user.id });

    socket.on('new_notification', (data) => {
      // 🔔 Phát tiếng chuông thông báo công khai
      const audio = new Audio('/notification-sound.mp3');
      audio.play().catch(e => console.log("Chờ tương tác người dùng để kích hoạt audio:", e));

      // Hiển thị Pop-up thông báo bằng Ant Design
      notification.success({
        message: data.title,
        description: data.message,
        placement: 'topRight', // Để góc dưới bên trái tránh đè lên chatbot AI của bạn
        duration: 10,
      });

      loadNotifications();
    });

    loadNotifications();

    return () => {
      socket.disconnect();
    };
  }, [user.id]);

  const markNotificationRead = async (notificationId) => {
    try {
      await API.patch(`/api/notifications/${notificationId}/read`);
      const response = await API.get('/api/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Không thể đánh dấu đã đọc', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await API.patch('/api/notifications/read-all');
      const response = await API.get('/api/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Không thể đánh dấu tất cả đã đọc', error);
    }
  };

  const handleOpenNotification = async (item) => {
    try {
      await markNotificationRead(item._id);

      if (item.type === 'discussion' && item.meta?.productId) {
        navigate(`/product/${item.meta.productId}#reviews-section`);
        return;
      }

      if (['order', 'order_status', 'order_cancel', 'order_received', 'order_auto_cancel'].includes(item.type)) {
        navigate('/my-orders');
      }
    } catch (error) {
      console.error('Không thể mở thông báo', error);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.dispatchEvent(new Event('auth-change'));
    window.location.href = '/login';
  };

  // Cấu hình Menu Dropdown khi click/hover vào Avatar
  const menuUserItems = [
    {
      key: 'profile',
      label: <Link to="/profile">Thông tin cá nhân</Link>,
      icon: <ProfileOutlined />,
    },
    {
      key: 'orders',
      label: <Link to="/my-orders">Đơn hàng của tôi</Link>,
      icon: <ShoppingOutlined />,
    },
    ...(user.role === 'admin' ? [{
      key: 'admin',
      label: <Link to="/admin">Trang Quản trị</Link>,
      icon: <SettingOutlined />,
    }] : []),
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Đăng xuất',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="gradient-header-footer" style={{ display: 'flex', alignItems: 'center', padding: '0 50px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <Link to="/">
          <img src="/public/logo.png" alt="Tech-Shop Logo" className="site-logo-img" />
        </Link>
        <Menu mode="horizontal" selectedKeys={getSelectedMenuKey()} style={{ flex: 1, borderBottom: 'none' }}>
          <Menu.Item key="1"><Link to="/">Trang chủ</Link></Menu.Item>
          <Menu.Item key="2"><Link to="/products">Sản phẩm</Link></Menu.Item>
        </Menu>
          
          <AutoComplete
            options={searchOptions}
            onSelect={handleSelectProduct}
            onSearch={(value) => setSearchKeyword(value)}
            value={searchKeyword}
            style={{ 
              width: 550, 
              boxShadow: 'none',     
              border: 'none',             
              background: 'transparent'    
            }}
            dropdownStyle={{ maxHeight: 190, overflowY: 'auto' }}
          >
            <Input
              placeholder="Tìm kiếm sản phẩm..."
              style={{ height: '40px', borderRadius: '20px', marginTop: '13px', marginRight: '30px' }}
              allowClear
              suffix={
                <SearchOutlined 
                  style={{ fontSize: 16, color: '#1890ff', cursor: 'pointer' }} 
                  onClick={handleSearchSubmit} 
                />
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
            />
          </AutoComplete>
        
        <div style={{ display: 'flex', gap: '25px', fontSize: '20px', alignItems: 'center' }}>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            onOpenNotification={handleOpenNotification}
          />

          <Link to="/cart">
            <Badge count={totalCount}>
              <ShoppingCartOutlined style={{ fontSize: '22px', color: '#000' }} />
            </Badge>
          </Link>

          {/* Logic hiển thị Avatar User mới */}
          {token ? (
            <Dropdown menu={{ items: menuUserItems }} placement="bottomRight" arrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Avatar 
                  icon={<UserOutlined />} 
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{user.name}</span>
              </div>
            </Dropdown>
          ) : (
            <Link to="/login" style={{ fontSize: '14px', color: '#000', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <UserOutlined style={{ fontSize: '18px' }} /> Đăng nhập
            </Link>
          )}
        </div>
      </Header>

      <Content style={{ padding: '24px 50px', background: '#f5f5f5' }}>
        <div style={{ background: '#fff', padding: 24, minHeight: 380, borderRadius: '8px' }}>
          <Outlet />
          <ChatAI />
        </div>
      </Content>

      <Footer className="gradient-header-footer" style={{ padding: '50px 50px 20px 50px', fontSize: '14px' }}>
        <Row gutter={[32, 32]} justify="space-between">
          
          {/* Cột 1: Giới thiệu về Website (Giữ nguyên) */}
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: '16px' }}>
               <img src="/public/logo.png" alt="Tech-Shop Logo" className="site-logo-img" />
            </div>
            <p style={{ color: '#a6a6a6', lineHeight: '1.6' }}>
              TECH-SHOP là hệ thống bán lẻ thiết bị công nghệ chính hãng hàng đầu, cung cấp các sản phẩm điện thoại, máy tính và phụ kiện cao cấp với mức giá cạnh tranh nhất.
            </p>
            <p style={{ color: '#a6a6a6' }}><strong>Địa chỉ:</strong> Ngõ 167, đường Z115, xã Quyết Thắng, TP. Thái Nguyên</p>
          </Col>

          {/* Cột 2: Chính sách mua hàng (ĐÃ ĐỔI SANG LIST ANTD) */}
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff', marginBottom: '16px' }}>Chính sách</div>
            <List
              split={false} // Ẩn đường kẻ gạch ngang giữa các item
              dataSource={policyData}
              renderItem={(item) => (
                <List.Item style={{ padding: '6px 0', border: 'none' }}>
                  <Link to={item.link} style={{ color: '#a6a6a6', transition: 'color 0.3s' }}>
                    {item.text}
                  </Link>
                </List.Item>
              )}
            />
          </Col>

          {/* Cột 3: Dịch vụ và Thông tin khác (ĐÃ ĐỔI SANG LIST ANTD) */}
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff', marginBottom: '16px' }}>Dịch vụ & Thông tin</div>
            <List
              split={false} // Ẩn đường kẻ gạch ngang giữa các item
              dataSource={serviceData}
              renderItem={(item) => (
                <List.Item style={{ padding: '6px 0', border: 'none' }}>
                  <Link to={item.link} style={{ color: '#a6a6a6', transition: 'color 0.3s' }}>
                    {item.text}
                  </Link>
                </List.Item>
              )}
            />
          </Col>

          {/* Cột 4: Kết nối & Liên kết (Giữ nguyên) */}
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff', marginBottom: '16px' }}>Kết nối với chúng tôi</div>
            <Space size="middle" style={{ marginBottom: '20px' }}>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" style={{ color: '#1890ff', fontSize: '24px' }}><FacebookOutlined /></a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" style={{ color: '#ff4d4f', fontSize: '24px' }}><YoutubeOutlined /></a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" style={{ color: '#ff4d4f', fontSize: '24px' }}><InstagramOutlined /></a>
              <a href="/" style={{ color: '#52c41a', fontSize: '24px' }}><GlobalOutlined /></a>
            </Space>
            <List
              split={false}
              dataSource={supportData}
              renderItem={(item) => (
                <List.Item style={{ padding: '6px 0', border: 'none' }}>
                  <Link to={item.link} style={{ color: '#a6a6a6', transition: 'color 0.3s' }}>
                    {item.text}
                  </Link>
                </List.Item>
              )}
            />
          </Col>

        </Row>

        <hr style={{ border: 'none', borderTop: '1px solid #262626', margin: '40px 0 20px 0' }} />

        <div style={{ textAlign: 'center', color: '#595959', fontSize: '13px' }}>
          Đồ án Tốt nghiệp ©2026 - Nguyễn Hữu Đạo. All rights reserved.
        </div>
      </Footer>
    </Layout>
  );
};

export default UserLayout;