import React, { useState, useEffect } from 'react'; 
import {useNavigate} from 'react-router-dom';
import { Layout, Menu, notification, Space } from 'antd'; 
import { 
  DashboardOutlined, 
  ShoppingOutlined, 
  OrderedListOutlined, 
  PieChartOutlined, 
  CommentOutlined, 
  LogoutOutlined, 
  HomeOutlined, 
  UserOutlined 
} from '@ant-design/icons';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client'; 
import API from '../utils/axiosClient';
import NotificationBell from '../components/NotificationBell.jsx';

const { Sider, Content } = Layout;

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();
  
  // 🌟 2. Lấy thông tin đường dẫn URL hiện tại của trình duyệt
  const location = useLocation();

  useEffect(() => {
    if (!user.id) return;

    const loadNotifications = async () => {
      try {
        const response = await API.get('/api/notifications');
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      } catch (error) {
        console.error('Không thể tải thông báo admin', error);
      }
    };

    const socket = io(import.meta.env.VITE_API_URL );

    socket.emit('join_room', { role: 'admin', userId: user.id });

    socket.on('new_notification', (data) => {
      const audio = new Audio('/notification-sound.mp3');
      audio.play().catch(e => console.log("Chờ tương tác người dùng để phát nhạc:", e));

      notification.info({
        message: data.title,
        description: data.message,
        placement: 'topRight',
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

      if (item.type === 'discussion') {
        navigate('/admin/reviews');
        return;
      }

      if (['order', 'order_status', 'order_cancel', 'order_received', 'order_auto_cancel'].includes(item.type)) {
        navigate('/admin/orders');
      }
    } catch (error) {
      console.error('Không thể mở thông báo', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change'));
    window.location.href = '/login';
  };

  const getCurrentMenuKey = () => {
    const path = location.pathname;
    if (path === '/admin') return ['1'];
    if (path.startsWith('/admin/products')) return ['2'];
    if (path.startsWith('/admin/orders')) return ['3'];
    if (path.startsWith('/admin/users')) return ['8'];
    if (path.startsWith('/admin/reports')) return ['4'];
    if (path.startsWith('/admin/reviews')) return ['5'];
    return ['1']; 
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', lineHeight: '32px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 5px' }}>
          {collapsed ? 'AD' : `Admin: ${user.name || 'Quản trị'}`}
        </div>
        
        <Menu 
          theme="dark" 
          selectedKeys={getCurrentMenuKey()} 
          mode="inline"
        >
          <Menu.Item key="6" icon={<HomeOutlined />}><Link to="/">Về cửa hàng</Link></Menu.Item>

          <Menu.Item key="1" icon={<DashboardOutlined />}><Link to="/admin">Dashboard</Link></Menu.Item>
          <Menu.Item key="2" icon={<ShoppingOutlined />}><Link to="/admin/products">Sản phẩm</Link></Menu.Item>
          <Menu.Item key="3" icon={<OrderedListOutlined />}><Link to="/admin/orders">Đơn hàng</Link></Menu.Item>
          <Menu.Item key="8" icon={<UserOutlined />}><Link to="/admin/users">Người dùng</Link></Menu.Item>
          <Menu.Item key="4" icon={<PieChartOutlined />}><Link to="/admin/reports">Báo cáo</Link></Menu.Item>
          <Menu.Item key="5" icon={<CommentOutlined />}><Link to="/admin/reviews">Đánh giá</Link></Menu.Item>

          <Menu.Item key="7" icon={<LogoutOutlined />} onClick={handleLogout} danger>Đăng xuất</Menu.Item>
        </Menu>
      </Sider>
      
      <Layout style={{ backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0 24px' }}>
          <Space>
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onOpenNotification={handleOpenNotification}           
            />
          </Space>
        </div>
        <Content style={{ margin: '0' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;