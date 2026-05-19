import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Spin, message, Row, Col } from 'antd';
import { DollarCircleOutlined, ExportOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import API from '../utils/axiosClient';

import 'antd/dist/reset.css'; 

const { Title } = Typography;

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0 });
  const [chartData, setChartData] = useState([]);
  const [reportData, setReportData] = useState([]);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const statsRes = await API.get('/api/admin/dashboard-stats');
        setStats(statsRes.data);

        const chartRes = await API.get('/api/admin/reports-chart');
        setChartData(chartRes.data);

        const ordersRes = await API.get('/api/admin/orders');
        const paidOrders = ordersRes.data.filter(
          order => order.status === 'PAID' || order.status === 'success' || order.paymentStatus === 'PAID'
        );
        setReportData(paidOrders);
      } catch (error) {
        console.error(error);
        message.error('Không thể tải dữ liệu báo cáo doanh thu');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      message.loading({ content: 'Đang khởi tạo cấu trúc dữ liệu báo cáo...', key: 'exportKey' });
      
      const response = await API({
        url: '/api/admin/export-reports',
        method: 'GET',
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bao_Cao_Doanh_Thu_TechShop_${new Date().toLocaleDateString('vi-VN')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success({ content: 'Đã xuất và tải file báo cáo Excel thành công!', key: 'exportKey', duration: 3 });
    } catch (error) {
      console.error(error);
      message.error({ content: 'Quá trình kết xuất file gặp lỗi, vui lòng thử lại!', key: 'exportKey' });
    } finally {
      setExportLoading(false);
    }
  };

  const columns = [
    {
      title: 'Mã Đơn hàng',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#374151' }}>{text}</span>
    },
    {
      title: 'Tên Khách hàng',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Ngày giao dịch',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('vi-VN')
    },
    {
      title: 'Phương thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (text) => (
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor: text === 'BANK_TRANSFER' ? '#dbeafe' : '#fef3c7',
          color: text === 'BANK_TRANSFER' ? '#1d4ed8' : '#b45309'
        }}>
          {text === 'BANK_TRANSFER' ? 'Chuyển khoản (SePay)' : 'Ship COD'}
        </span>
      )
    },
    {
      title: 'Số tiền thực thu',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (val) => <span style={{ fontWeight: '600', color: '#10b981' }}>+{val?.toLocaleString()} đ</span>
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px', margin: '80px 0' }}>
        <Spin size="large" tip="Đang kết xuất báo cáo tài chính từ hệ thống..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* KHỐI TIÊU ĐỀ & NÚT BẤM */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px', 
        borderBottom: '1px solid #e2e8f0', 
        paddingBottom: '20px' 
      }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <Title level={2} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
            Báo cáo & Thống kê doanh thu tài chính
          </Title>
        </div>
        
        <button 
          onClick={handleExportExcel}
          disabled={exportLoading || reportData.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: exportLoading || reportData.length === 0 ? '#94a3b8' : '#10b981',
            color: '#ffffff',
            padding: '10px 22px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            cursor: exportLoading || reportData.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
          }}
        >
          {exportLoading ? <Spin size="small" /> : <ExportOutlined />} 
          {exportLoading ? 'Đang xuất file...' : 'Xuất file báo cáo'}
        </button>
      </div>

      {/* Khối thống kê tổng quan - Sử dụng inline style bọc ngoài để ép khoảng cách dưới cách biệt 32px */}
      <div style={{ marginBottom: '32px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div style={{
              padding: '24px',
              background: 'linear-gradient(135deg, #10b981 0%, #0db9a2 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <p style={{ color: '#a7f3d0', fontWeight: '500', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>TỔNG DOANH THU THUẦN THỰC TẾ</p>
                  <h3 style={{ fontSize: '30px', fontWeight: '700', margin: 0, trackingTight: '-0.025em' }}>{stats.totalRevenue?.toLocaleString()} <span style={{ fontSize: '18px', fontWeight: '400' }}>VNĐ</span></h3>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(167, 243, 208, 0.8)', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                Dữ liệu đối soát tự động theo thời gian thực từ API SePay.
              </div>
            </div>
          </Col>
          
          <Col xs={24} md={12}>
            <div style={{
              padding: '24px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#1e293b',
              borderRadius: '12px',
              boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <p style={{ color: '#94a3b8', fontWeight: '500', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>TỔNG SỐ ĐƠN THANH TOÁN THÀNH CÔNG</p>
                  <h3 style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{reportData.length} <span style={{ fontSize: '18px', fontWeight: '400', color: '#64748b' }}>Đơn hàng</span></h3>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                Hệ thống tự động ghi nhận và đồng bộ trạng thái trừ kho.
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Khu vực đồ thị Recharts - Sử dụng inline style bọc ngoài để ép khoảng cách dưới cách biệt 32px */}
      <div style={{ marginBottom: '32px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title={<span style={{ fontWeight: '600', color: '#1e293b' }}>Biểu đồ xu hướng tăng trưởng doanh thu (Năm nay)</span>} style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    {/* Tăng chiều rộng trục Y (width={70}) giúp số không bị khuất chữ, căn lề sang phải và chỉnh margin phù hợp */}
                    <YAxis 
                      width={70} 
                      stroke="#94a3b8" 
                      fontSize={12} 
                      tickLine={false} 
                      tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`} 
                    />
                    <Tooltip formatter={(value) => [`${value.toLocaleString()} VNĐ`, 'Doanh Thu']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Area type="monotone" dataKey="DoanhThu" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          
          <Col xs={24} lg={10}>
            <Card title={<span style={{ fontWeight: '600', color: '#1e293b' }}>Số lượng đơn hàng hoàn tất theo tháng</span>} style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value} đơn`, 'Số lượng']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="DonHang" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} name="Đơn hàng" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Bảng nhật ký dòng tiền */}
      <Card title={<span style={{ fontWeight: '600', color: '#1e293b' }}>Nhật ký dòng tiền - Đối soát đơn hàng hoàn tất</span>} style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
        <Table 
          columns={columns} 
          dataSource={reportData} 
          rowKey="_id"
          pagination={{ pageSize: 5 }}
          style={{ overflow: 'hidden', borderRadius: '8px' }}
          bordered={false}
        />
      </Card>
    </div>
  );
};

export default AdminReports;