import React, { useState, useEffect } from 'react'; 
import { Layout, Menu, notification } from 'antd'; 
import { DashboardOutlined, ShoppingOutlined, OrderedListOutlined, PieChartOutlined, CommentOutlined, LogoutOutlined, HomeOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, Link } from 'react-router-dom';
import { io } from 'socket.io-client'; 
const { Sider, Content } = Layout;

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.id) return;

    const socket = io('http://localhost:5000'); // Port backend của bạn

    // Đăng ký vào phòng của Admin
    socket.emit('join_room', { role: 'admin', userId: user.id });

    // Lắng nghe sự kiện thông báo mới
    socket.on('new_notification', (data) => {
      // 🔔 Phát tiếng chuông thông báo công khai
      const audio = new Audio('/notification-sound.mp3');
      audio.play().catch(e => console.log("Chờ tương tác người dùng để phát nhạc:", e));

      // Hộp thông báo của Ant Design bay ra ở góc màn hình
      notification.info({
        message: data.title,
        description: data.message,
        placement: 'topRight',
        duration: 10,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user.id]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: '#fff', lineHeight: '32px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 5px' }}>
          {collapsed ? 'AD' : `Admin: ${user.name || 'Quản trị'}`}
        </div>
        <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
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
      <Layout>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, minHeight: 360, background: '#fff', borderRadius: '8px' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;