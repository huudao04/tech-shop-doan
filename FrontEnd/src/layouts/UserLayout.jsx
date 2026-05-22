import { useState, useEffect } from 'react'; 
import { Layout, Menu, Input, Badge, Dropdown, Avatar, notification, Space, AutoComplete } from 'antd';
import { ProfileOutlined, ShoppingOutlined, SettingOutlined, LogoutOutlined, ShoppingCartOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import ChatAI from '../components/ChatBotAI.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import { useCart } from '../context/CartContex.jsx';
import API from '../utils/axiosClient';
import { io } from 'socket.io-client';

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
                  src={(() => {
                    const imageName = Array.isArray(prod.image) ? prod.image[0] : prod.image;
                    return imageName
                      ? (imageName.startsWith('http') ? imageName : `/images/${imageName}`)
                      : 'https://via.placeholder.com/40';
                  })()} 
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

    const socket = io('http://localhost:5000');

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
      <Header style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0 50px', boxShadow: '0 2px 8px #f0f1f2', position: 'sticky', top: 0, zIndex: 1000 }}>
        <Link to="/">
          <div className="logo" style={{ fontWeight: 'bold', fontSize: '20px', marginRight: '40px', color: '#1677ff' }}>TECH-SHOP</div>
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

      <Footer style={{ textAlign: 'center' }}>Đồ án Tốt nghiệp ©2026 - Nguyễn Hữu Đạo</Footer>
    </Layout>
  );
};

export default UserLayout;