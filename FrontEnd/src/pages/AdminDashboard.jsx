import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Spin, message, Typography } from 'antd';
import { 
  DatabaseOutlined, 
  ShoppingOutlined, 
  DollarCircleOutlined, 
  ClockCircleOutlined
} from '@ant-design/icons';
import API from '../utils/axiosClient';

// Ép cấu hình reset CSS của Ant Design để đồng bộ font và bảng
import 'antd/dist/reset.css'; 

const { Title } = Typography;

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/admin/dashboard-stats');
      setStats(res.data);
    } catch (error) {
      console.error(error);
      message.error('Không thể tải số liệu thống kê Dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px', margin: '80px 0' }}>
        <Spin size="large" tip="Đang tải dữ liệu hệ thống..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Tiêu đề trang Dashboard */}
      <div style={{ marginBottom: '28px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <Title level={2} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
          Bảng điều khiển hệ thống quản trị
        </Title>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
          Chào mừng trở lại! Dưới đây là thông số tổng hợp tình hình hoạt động kinh doanh của cửa hàng công nghệ TechShop.
        </p>
      </div>

      {/* Lưới hiển thị 4 thẻ thống kê chính */}
      <Row gutter={[16, 16]}>
        
        {/* Khối 1: Tổng doanh thu thực tế */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #10b981', // Màu xanh emerald chủ đạo
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            background: 'linear-gradient(to right, #f0fdf4 0%, #ffffff 100%)'
          }}>
            <Statistic
              title={<span style={{ fontWeight: '600', color: '#64748b', fontSize: '12px', trackingWidth: '0.05em' }}>TỔNG DOANH THU THỰC TẾ</span>}
              value={stats.totalRevenue}
              valueStyle={{ color: '#10b981', fontWeight: '700', fontSize: '22px' }}
              prefix={<DollarCircleOutlined style={{ marginRight: '4px' }} />}
              suffix="đ"
            />
          </div>
        </Col>

        {/* Khối 2: Số đơn hàng hoàn tất thanh toán */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #3b82f6', // Màu xanh dương
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            background: 'linear-gradient(to right, #eff6ff 0%, #ffffff 100%)'
          }}>
            <Statistic
              title={<span style={{ fontWeight: '600', color: '#64748b', fontSize: '12px' }}>TỔNG SỐ ĐƠN HÀNG ĐƯỢC THỰC HIỆN</span>}
              value={stats.totalOrders}
              valueStyle={{ color: '#3b82f6', fontWeight: '700', fontSize: '22px' }}
              prefix={<ShoppingOutlined style={{ marginRight: '4px' }} />}
              suffix="đơn"
            />
          </div>
        </Col>

        {/* Khối 3: Đơn hàng chờ thanh toán/xử lý */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #f59e0b', // Màu vàng hổ phách
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            background: 'linear-gradient(to right, #fffbeb 0%, #ffffff 100%)'
          }}>
            <Statistic
              title={<span style={{ fontWeight: '600', color: '#64748b', fontSize: '12px' }}>ĐƠN CHỜ XỬ LÝ (PENDING)</span>}
              value={stats.pendingOrders}
              valueStyle={{ color: '#d97706', fontWeight: '700', fontSize: '22px' }}
              prefix={<ClockCircleOutlined style={{ marginRight: '4px' }} />}
              suffix="đơn"
            />
          </div>
        </Col>

        {/* Khối 4: Tổng số lượng mã sản phẩm */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{
            padding: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #8b5cf6', // Màu tím
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            background: 'linear-gradient(to right, #faf5ff 0%, #ffffff 100%)'
          }}>
            <Statistic
              title={<span style={{ fontWeight: '600', color: '#64748b', fontSize: '12px' }}>SẢN PHẨM TRONG KHO</span>}
              value={stats.totalProducts}
              valueStyle={{ color: '#6d28d9', fontWeight: '700', fontSize: '22px' }}
              prefix={<DatabaseOutlined style={{ marginRight: '4px' }} />}
              suffix="mã"
            />
          </div>
        </Col>

      </Row>

    </div>
  );
};

export default AdminDashboard;