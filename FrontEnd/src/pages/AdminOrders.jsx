import React, { useState, useEffect } from 'react';
import { Table, Tag, Select, Typography, message, Card, Popover } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';

const { Title } = Typography;
const { Option } = Select;

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/admin/orders');
      setOrders(res.data);
    } catch (error) {
      message.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Xử lý đổi trạng thái đơn hàng (Đồng bộ qua API PUT admin)
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await API.put(`/api/admin/orders/${orderId}`, { status: newStatus });
      message.success('Cập nhật trạng thái đơn hàng thành công!');
      fetchOrders(); // Reload lại data
    } catch (error) {
      message.error('Lỗi khi cập nhật trạng thái đơn hàng');
    }
  };

  // Render danh sách sản phẩm trong đơn khi hover/click vào cột Chi tiết
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
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status) => {
        let color = 'gold';
        if (status === 'PAID') color = 'green';
        if (status === 'FAILED') color = 'red';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Trạng thái vận đơn',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Select
          defaultValue={status}
          style={{ width: 140 }}
          onChange={(value) => handleStatusChange(record._id, value)}
          className="font-medium"
        >
          <Option value="PROCESSING"><span className="text-blue-600">PROCESSING</span></Option>
          <Option value="SHIPPED"><span className="text-purple-600">SHIPPED</span></Option>
          <Option value="DELIVERED"><span className="text-green-600">DELIVERED</span></Option>
          <Option value="CANCELLED"><span className="text-gray-400">CANCELLED</span></Option>
        </Select>
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="mb-4">
        <Title level={3}>Quản lý và Duyệt đơn hàng</Title>
      </div>

      <Table 
        dataSource={orders} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        className="shadow-sm border border-gray-100 rounded-lg overflow-hidden"
      />
    </div>
  );
};

export default AdminOrders;