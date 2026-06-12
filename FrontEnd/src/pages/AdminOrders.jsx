import React, { useState, useEffect } from 'react';
import { Table, Tag, Select, Typography, message, Card, Popover, Space, Input, DatePicker } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';

const { Title } = Typography;
const { Option } = Select;

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    paymentMethod: undefined,
    province: undefined,
    date: undefined
  }); 

  const fetchFilterData = async () => {
    try {
      // Gọi đồng thời cả 2 API tách biệt
      const [statusRes, paymentRes] = await Promise.all([
        API.get('/api/orders/statuses'),
        API.get('/api/orders/payment-methods')
      ]);

      if (statusRes.data.success) setStatuses(statusRes.data.data);
      if (paymentRes.data.success) setPaymentMethods(paymentRes.data.data);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu cấu hình bộ lọc:", error);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
      if (filters.province) params.province = filters.province;
      if (filters.date) params.date = filters.date;

      const res = await API.get('/api/admin/orders', { params });
      setOrders(res.data);
    } catch (error) {
      message.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterData();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  // Xử lý đổi trạng thái đơn hàng (Đồng bộ qua API PUT tiếng Việt của admin)
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await API.put(`/api/admin/orders/${orderId}`, { status: newStatus });
      message.success('Cập nhật trạng thái đơn hàng thành công!');
      fetchOrders(); 
    } catch (error) {
      message.error('Lỗi khi cập nhật trạng thái đơn hàng');
    }
  };

  const renderItemsPopover = (items) => (
    <div className="max-w-md">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-1 pr-4">Tên sản phẩm</th>
            <th className="pb-1 pr-4 text-center">SL</th>
            <th className="pb-1 text-right">Đơn giá</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-50">
              <td className="py-1.5 pr-4 font-medium text-gray-700">{item.name}</td>
              <td className="py-1.5 pr-4 text-center text-gray-500">{item.quantity}</td>
              <td className="py-1.5 text-right text-blue-600">{item.price?.toLocaleString()} đ</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const columns = [
    {
      title: 'Mã Đơn',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (text) => <span className="font-mono font-bold text-gray-800">{text}</span>
    },
    {
      title: 'Khách hàng',
      key: 'customerName',
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.customerName}</div>
          <div className="text-xs text-gray-400">{record.phoneNumber}</div>
        </div>
      )
    },
    {
      title: 'Địa chỉ giao hàng',
      dataIndex: 'shippingAddress',
      key: 'shippingAddress',
      ellipsis: true
    },
    {
      title: 'Giỏ hàng',
      dataIndex: 'items',
      key: 'items',
      render: (items) => (
        <Popover content={renderItemsPopover(items)} title="Chi tiết sản phẩm mua" trigger="click">
          <span className="text-blue-500 hover:text-blue-700 cursor-pointer flex items-center gap-1">
            <EyeOutlined /> Xem ({items?.reduce((sum, i) => sum + i.quantity, 0)} món)
          </span>
        </Popover>
      )
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (val) => <span className="font-semibold text-red-500">{val?.toLocaleString()} VNĐ</span>
    },
    {
      title: 'Thanh toán',
      key: 'paymentDisplay',
      render: (_, record) => {
        if (record.paymentMethod === 'COD') {
          return (
            <div>
              <Tag color="blue" className="mt-1">Ship COD</Tag>
            </div>
          );
        }

        const isPaid = record.paymentStatus === 'Đã thanh toán';
        const isFailed = record.paymentStatus === 'Thanh toán thất bại';

        let color = 'gold';
        let statusText = 'Chờ thanh toán';

        if (isPaid) {
          color = 'green';
          statusText = 'Đã thanh toán';
        } else if (isFailed) {
          color = 'red';
          statusText = 'Thanh toán thất bại';
        }

        return (
          <div>
            <div className="font-medium text-gray-700">Chuyển khoản QR</div>
            <Tag color={color} className="mt-1">{statusText}</Tag>
          </div>
        );
      }
    },
    {
      title: 'Trạng thái vận đơn',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        // Logic khóa hộp chọn: 
        // Nếu là đơn Chuyển khoản QR nhưng CHƯA thanh toán thành công thì khóa cứng (disabled)
        const isQrNotPaid = record.paymentMethod === 'BANK_TRANSFER' && 
                            record.paymentStatus !== 'Đã thanh toán'

        // Đơn hàng đã hoàn thành ('Đã nhận'), đã hủy, hoặc đơn QR chưa thanh toán thì không cho Admin đổi trạng thái
        const isDisabled = status === 'Đã nhận' || status === 'Hủy đơn hàng';

        return (
          <Select
            value={status}
            style={{ width: 170 }}
            onChange={(value) => handleStatusChange(record._id, value)}
            className="font-medium"
            disabled={isDisabled}
            placeholder={isQrNotPaid ? "Chờ khách quét QR" : "Chọn trạng thái"}
          >
            <Option value="Chờ xác nhận"><span className="text-orange-500">Chờ xác nhận</span></Option>
            <Option value="Đang đóng gói"><span className="text-cyan-600">Đang đóng gói</span></Option>
            <Option value="Đang giao"><span className="text-purple-600">Đang giao</span></Option>
            <Option value="Đã nhận" disabled><span className="text-green-600">Đã nhận</span></Option>
            <Option value="Hủy đơn hàng"><span className="text-red-500 font-bold">Hủy đơn hàng</span></Option>
          </Select>
        );
      }
    }
  ];

  return (
    <div className="p-4">
      <div style={{marginBottom: 20, marginLeft: 10}}>
        <Title level={3}>Quản lý và Duyệt đơn hàng</Title>
      </div>

      {/* 🌟 THANH TÌM KIẾM & BỘ LỌC ĐA NĂNG CHO ADMIN */}
      <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
        <Space direction="horizontal" wrap size="middle" style={{ width: '100%' }}>
          
          <Input.Search
            placeholder="Tìm theo mã đơn, tên khách..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 260 }}
            onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
          />

          <DatePicker 
            placeholder="Chọn ngày đặt hàng"
            style={{ width: 170 }}
            onChange={(date, dateString) => setFilters(prev => ({ ...prev, date: dateString || undefined }))} 
          />

           <Input 
            placeholder="Gõ nhanh Tỉnh/Thành lọc..." 
            allowClear
            style={{ width: 180 }}
            onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
          />
          
          <Select
            placeholder="Phương thức thanh toán"
            style={{ width: 180 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}
          >
            {/* 🌟 Map dữ liệu từ mảng paymentMethods riêng biệt */}
            {paymentMethods.map(method => (
              <Option key={method} value={method}>
                {method === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản (BANK)'}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="Lọc theo trạng thái"
            style={{ width: 160 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            {/* 🌟 Map dữ liệu từ mảng statuses riêng biệt */}
            {statuses.map(status => (
              <Option key={status} value={status}>{status}</Option>
            ))}
          </Select>
          
        </Space>
      </Card>

      <Table 
        dataSource={orders} 
        columns={columns} 
        rowKey="_id"
        loading={loading}
      />
    </div>
  );
}

export default AdminOrders;