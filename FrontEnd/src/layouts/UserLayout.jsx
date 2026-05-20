import { Layout, Menu, Input, Badge, Button, Dropdown, Avatar } from 'antd';
import { ShoppingCartOutlined, ShoppingOutlined, UserOutlined, SettingOutlined, LogoutOutlined, ProfileOutlined, CommentOutlined } from '@ant-design/icons';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import ChatAI from '../components/ChatBotAI.jsx';
import { useCart } from '../context/CartContex.jsx';

const { Header, Content, Footer } = Layout;

const UserLayout = () => {
  const { totalCount } = useCart();
  const navigate = useNavigate();

  // Đọc thông tin người dùng từ localStorage
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
     ...(user.role === 'customer' ? [{  
      key: 'orders',
      label: <Link to="/my-orders">Đơn hàng của tôi</Link>,
      icon: <ShoppingOutlined />,
    }] :
     []),
    
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
        <Menu mode="horizontal" defaultSelectedKeys={['1']} style={{ flex: 1, borderBottom: 'none' }}>
          <Menu.Item key="1"><Link to="/">Trang chủ</Link></Menu.Item>
          <Menu.Item key="2"><Link to="/products">Sản phẩm</Link></Menu.Item>
        </Menu>
        
        <Input.Search placeholder="Tìm sản phẩm..." style={{ width: 300, marginRight: 20 }} />
        
        <div style={{ display: 'flex', gap: '25px', fontSize: '20px', alignItems: 'center' }}>
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