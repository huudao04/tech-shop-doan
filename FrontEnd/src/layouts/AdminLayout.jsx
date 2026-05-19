import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { DashboardOutlined, ShoppingOutlined, OrderedListOutlined, PieChartOutlined, CommentOutlined, LogoutOutlined, HomeOutlined } from '@ant-design/icons';
import { Outlet, Link } from 'react-router-dom';

const { Sider, Content } = Layout;

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
          <Menu.Item key="1" icon={<DashboardOutlined />}><Link to="/admin">Dashboard</Link></Menu.Item>
          <Menu.Item key="2" icon={<ShoppingOutlined />}><Link to="/admin/products">Sản phẩm</Link></Menu.Item>
          <Menu.Item key="3" icon={<OrderedListOutlined />}><Link to="/admin/orders">Đơn hàng</Link></Menu.Item>
          <Menu.Item key="4" icon={<PieChartOutlined />}><Link to="/admin/reports">Báo cáo</Link></Menu.Item>
          <Menu.Item key="5" icon={<CommentOutlined />}><Link to="/admin/reviews">Đánh giá</Link></Menu.Item>
          
          {/* Lối tắt quay về trang chủ khách hàng và Đăng xuất */}
          <Menu.Item key="6" icon={<HomeOutlined />}><Link to="/">Xem Trang Chủ</Link></Menu.Item>
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