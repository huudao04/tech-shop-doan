import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Button, Spin, message, Typography } from 'antd';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  DownloadOutlined, 
  DollarCircleOutlined, 
  LineChartOutlined,
  ShoppingOutlined
} from '@ant-design/icons';
import API from '../utils/axiosClient';
import 'antd/dist/reset.css';

const { Title } = Typography;

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalOrdersCount: 0
  });

  const fetchReportData = async () => {
    try {
    setExportLoading(true);
      setLoading(true);
      const res = await API.get('/api/admin/reports-chart');
      // API mới trả về cấu trúc đối tượng { months, totalRevenue, totalOrdersCount }
      if (res.data && res.data.months) {
        setChartData(res.data.months);
        setSummary({
          totalRevenue: res.data.totalRevenue || 0,
          totalOrdersCount: res.data.totalOrdersCount || 0
        });
        setExportLoading(false);
      } else {
        // Fallback phòng trường hợp mảng cũ
        setChartData(Array.isArray(res.data) ? res.data : []);
        setExportLoading(false);
      }
    } catch (error) {
      setExportLoading(false);
      console.error(error);
      message.error('Không thể tải dữ liệu báo cáo thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleExportExcel = async () => {
    try {
      message.loading({ content: 'Đang khởi tạo file Excel...', key: 'export' });
      const response = await API.get('/api/admin/export-reports', { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bao_Cao_Doanh_Thu_TechShop_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success({ content: 'Tải báo cáo Excel thành công!', key: 'export', duration: 2 });
    } catch (error) {
      console.error(error);
      message.error({ content: 'Xuất file Excel thất bại!', key: 'export' });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', margin: '80px 0' }}>
        <Spin size="large" tip="Đang tổng hợp dữ liệu báo cáo..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Header báo cáo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <Title level={2} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
            Báo cáo & Thống kê Doanh thu
          </Title>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
            Phân tích chuyên sâu về chỉ số doanh thu thực tế và tần suất đơn hàng theo thời gian thực.
          </p>
        </div>
        <Button 
          type="primary" 
          icon={<DownloadOutlined />} 
          size="large"
          onClick={handleExportExcel}
          loading={exportLoading}
          style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: 600, borderRadius: '6px' }}
        >
          Xuất file Excel
        </Button>
      </div>

      {/* Thẻ số liệu tổng hợp đầu trang Report */}
      <Row gutter={[16, 16]} style={{ marginBottom: '28px' }}>
        <Col xs={24} md={12}>
          <Card style={{ borderLeft: '5px solid #10b981', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#64748b' }}>TỔNG DOANH THU THỰC TẾ (NĂM HIỆN TẠI)</span>}
              value={summary.totalRevenue}
              valueStyle={{ color: '#10b981', fontWeight: 700 }}
              prefix={<DollarCircleOutlined />}
              suffix="đ"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={{ borderLeft: '5px solid #3b82f6', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#64748b' }}>SỐ ĐƠN HÀNG ĐÃ ĐỐI SOÁT DÒNG TIỀN</span>}
              value={summary.totalOrdersCount}
              valueStyle={{ color: '#3b82f6', fontWeight: 700 }}
              prefix={<ShoppingOutlined />}
              suffix="đơn"
            />
          </Card>
        </Col>
      </Row>

      {/* Đồ thị trực quan */}
      <Row gutter={[16, 16]}>
        
        {/* Biểu đồ doanh thu */}
        <Col xs={24} xl={12}>
          <Card 
            title={<span style={{ fontWeight: 600, color: '#1e293b' }}><LineChartOutlined style={{ color: '#10b981', marginRight: '8px' }} /> Biểu đồ xu hướng doanh thu hàng tháng</span>}
            style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => [`${value.toLocaleString('vi-VN')} đ`, 'Doanh Thu']} />
                  <Legend />
                  <Line type="monotone" dataKey="DoanhThu" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} name="Doanh Thu (đ)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Biểu đồ lượng đơn hàng */}
        <Col xs={24} xl={12}>
          <Card 
            title={<span style={{ fontWeight: 600, color: '#1e293b' }}><ShoppingOutlined style={{ color: '#3b82f6', marginRight: '8px' }} /> Biểu đồ sản lượng đơn hàng thành công</span>}
            style={{ borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} đơn`, 'Số Lượng']} />
                  <Legend />
                  <Bar dataKey="DonHang" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Số Đơn Hàng" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

      </Row>

    </div>
  );
};

export default AdminReports;