import { Layout, Menu, Input, Badge } from 'antd';
import { ShoppingCartOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, Link } from 'react-router-dom';
import ChatAI from '../components/ChatBotAI.jsx';
import { useCart } from '../context/CartContex.jsx';
const { Header, Content, Footer } = Layout;
const UserLayout = () => {
  const { totalCount } = useCart()
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0 50px', boxShadow: '0 2px 8px #f0f1f2', position: 'sticky', top: 0, zIndex: 1000 }}>
        <Link to="/">
          <div className="logo" style={{ fontWeight: 'bold', fontSize: '20px', marginRight: '40px' }}>TECH-SHOP</div>
        </Link>
        <Menu mode="horizontal" defaultSelectedKeys={['1']} style={{ flex: 1, borderBottom: 'none' }}>
          <Menu.Item key="1"><Link to="/">Trang chủ</Link></Menu.Item>
          <Menu.Item key="2"><Link to="/products">Sản phẩm</Link></Menu.Item>
        </Menu>
        <Input.Search placeholder="Tìm sản phẩm..." style={{ width: 300, marginRight: 20 }} />
        <div style={{ display: 'flex', gap: '20px', fontSize: '20px' }}>
          <Link to="/cart">
            <Badge count={totalCount}>
              <ShoppingCartOutlined style={{fontSize:'20px'}}/>
            </Badge>
          </Link>
          <UserOutlined />
        </div>
      </Header>

      <Content style={{ padding: '24px 50px', background: '#f5f5f5' }}>
        <div style={{ background: '#fff', padding: 24, minHeight: 380, borderRadius: '8px' }}>
          <Outlet /> {/* Nơi các trang con như Home, Detail sẽ hiển thị */}
          <ChatAI /> {/* Chatbot AI luôn sẵn sàng ở góc phải dưới */}
        </div>
      </Content>

      <Footer style={{ textAlign: 'center' }}>Đồ án Tốt nghiệp ©2026 - Nguyễn Hữu Đạo</Footer>
    </Layout>
  );
};

export default UserLayout;