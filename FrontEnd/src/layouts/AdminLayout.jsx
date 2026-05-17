import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { DashboardOutlined, ShoppingOutlined, OrderedListOutlined, PieChartOutlined, CommentOutlined } from '@ant-design/icons';
import { Outlet, Link } from 'react-router-dom';

const { Sider, Content } = Layout;

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: '#fff', lineHeight: '32px' }}>{collapsed ? 'AD' : 'Trang quản trị'}</div>
        <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
          <Menu.Item key="1" icon={<DashboardOutlined />}><Link to="/admin">Dashboard</Link></Menu.Item>
          <Menu.Item key="2" icon={<ShoppingOutlined />}><Link to="/admin/products">Sản phẩm</Link></Menu.Item>
          <Menu.Item key="3" icon={<OrderedListOutlined />}><Link to="/admin/orders">Đơn hàng</Link></Menu.Item>
          <Menu.Item key="4" icon={<PieChartOutlined />}><Link to="/admin/reports">Báo cáo</Link></Menu.Item>
          <Menu.Item key="5" icon={<CommentOutlined />}><Link to="/admin/reviews">Đánh giá</Link></Menu.Item>
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