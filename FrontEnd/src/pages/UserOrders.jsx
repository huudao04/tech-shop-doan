import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, message, Card, Popover } from 'antd';
import { EyeOutlined, ClockCircleOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient'; 

const { Title } = Typography;

const UserOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMyOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get('api/customer/orders');
      setOrders(res.data);
    } catch (error) {
      message.error('Không thể tải danh sách đơn hàng của bạn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyOrders();
  }, []);

  // Render danh sách sản phẩm trong Popover khi click xem chi tiết
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
      title: 'Ngày đặt',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => <span>{new Date(date).toLocaleString('vi-VN')}</span>
    },
    {
      title: 'Địa chỉ nhận hàng',
      dataIndex: 'shippingAddress',
      key: 'shippingAddress',
      ellipsis: true
    },
    {
      title: 'Chi tiết món',
      dataIndex: 'items',
      key: 'items',
      render: (items) => (
        <Popover content={renderItemsPopover(items)} title="Sản phẩm đã mua" trigger="click">
          <span className="text-blue-500 hover:text-blue-700 cursor-pointer flex items-center gap-1">
            <EyeOutlined /> Xem ({items?.reduce((sum, i) => sum + i.quantity, 0)} sản phẩm)
          </span>
        </Popover>
      )
    },
    {
      title: 'Tổng thanh toán',
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
      title: 'Trạng thái vận chuyển',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'blue';
        if (status === 'CONFIRMED') color = 'cyan';
        if (status === 'SHIPPED') color = 'purple';
        if (status === 'DELIVERED') color = 'green';
        if (status === 'CANCELLED') color = 'gray';
        
        return <Tag color={color} className="font-medium">{status}</Tag>;
      }
    }
  ];

  return (
    <Card className="shadow-sm rounded-lg border border-gray-100">
      <div className="mb-4 flex items-center gap-2">        
        <Title level={4} style={{ margin: 0 }}>
            <ClockCircleOutlined style={{ marginRight: '8px' }} />
            Lịch sử đơn hàng của tôi
        </Title>
      </div>

      <Table 
        dataSource={orders} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 5 }}
        className="overflow-hidden"
      />
    </Card>
  );
};

export default UserOrders;