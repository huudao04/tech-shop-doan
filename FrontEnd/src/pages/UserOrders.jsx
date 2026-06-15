import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, message, Card, Popover, Button, Popconfirm, Space, Input, Select, DatePicker, Drawer } from 'antd';
import { EyeOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import API from '../utils/axiosClient'; 
import { io } from 'socket.io-client';

const { Title } = Typography;
const { Option } = Select;

const UserOrders = () => {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    paymentMethod: undefined,
    province: undefined,
    date: undefined
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const search = params.get('search') || '';

    if (search) {
      setFilters(prev => ({ ...prev, search }));
    }
  }, [location.search]);

  const fetchFilterData = async () => {
    try {
      const [statusRes, paymentRes] = await Promise.all([
        API.get('/api/orders/statuses'),
        API.get('/api/orders/payment-methods')
      ]);

      if (statusRes.data.success) setStatuses(statusRes.data.data);
      if (paymentRes.data.success) setPaymentMethods(paymentRes.data.data);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu bộ lọc phía khách hàng:", error);
    }
  };

  const fetchMyOrders = async () => {
      try {
        setLoading(true);
        const params = {};
        if (filters.search) params.search = filters.search;
        if (filters.status) params.status = filters.status;
        if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
        if (filters.province) params.province = filters.province;
        if (filters.date) params.date = filters.date;

        const res = await API.get('/api/customer/orders', { params });
        setOrders(res.data);
      } catch (error) {
        message.error('Không thể tải danh sách đơn hàng của bạn');
      } finally {
        setLoading(false);
      }
    };
    useEffect(() => {
      fetchFilterData();
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
      fetchMyOrders();
    }, [filters]);

    useEffect(() => {
    const socket = io('https://backend-techshop.onrender.com' || 'http://localhost:5000'); 
    const currentUser = JSON.parse(localStorage.getItem('user')); 
    if (currentUser?._id) {
      socket.emit('join_room', { userId: currentUser._id, role: 'customer' });
    }
    socket.on('order_payment_updated', (data) => {
      message.success(`Đơn hàng ${data.orderId} đã chuyển khoản thành công! 🎉`);
      fetchMyOrders(); 
    });
    return () => {
      socket.off('order_payment_updated');
      socket.disconnect();
    };
  }, []);

  // Người dùng chủ động hủy đơn hàng
  const handleCancelOrder = async (id) => {
    try {
      await API.patch(`/api/customer/orders/${id}/cancel`);
      message.success('Đã hủy đơn hàng thành công!');
      fetchMyOrders();
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể hủy đơn hàng');
    }
  };

  // Người dùng xác nhận đã nhận được hàng
  const handleReceiveOrder = async (id) => {
    try {
      await API.patch(`/api/customer/orders/${id}/receive`);
      message.success('Cảm ơn bạn đã xác nhận nhận hàng thành công!');
      fetchMyOrders();
    } catch (error) {
      message.error('Xác nhận nhận hàng thất bại');
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
        <Popover content={renderItemsPopover(items)} trigger="click">
          <span className="text-blue-500 hover:text-blue-700 cursor-pointer flex items-center gap-1">
            <EyeOutlined />  {items?.reduce((sum, i) => sum + i.quantity, 0)} sản phẩm
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
      key: 'paymentDisplay',
      render: (_, record) => {
        // Nếu chọn COD -> Trả về text "Ship COD" luôn
        if (record.paymentMethod === 'COD') {
          return (
            <div>
              <Tag color="blue" className="mt-0.5">Ship COD</Tag>
            </div>
          );
        }

        // Nếu chọn Chuyển khoản QR
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
            <span className="text-xs text-gray-500 block">Chuyển khoản QR</span>
            <Tag color={color} className="mt-0.5">{statusText}</Tag>
          </div>
        );
      }
    },
    {
      title: 'Trạng thái đơn hàng',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'blue';
        if (status === 'Chờ xác nhận') color = 'orange';
        if (status === 'Đang đóng gói') color = 'cyan';
        if (status === 'Đang giao') color = 'purple';
        if (status === 'Đã nhận') color = 'green';
        if (status === 'Hủy đơn hàng') color = 'error';
        
        return <Tag color={color} className="font-medium">{status}</Tag>;
      }
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => {
        if (record.status === 'Chờ xác nhận') {
          return (
            <Popconfirm
              title="Bạn chắc chắn muốn hủy đơn hàng này chứ?"
              onConfirm={() => handleCancelOrder(record._id)}
              okText="Đồng ý"
              cancelText="Không"
            >
              <Button type="text" danger icon={<CloseCircleOutlined />} size="small" className="btn-action">
                Hủy đơn
              </Button>
            </Popconfirm>
          );
        }
        if (record.status === 'Đang giao') {
          return (
            <Popconfirm
              title="Bạn xác nhận đã nhận đầy đủ hàng và thanh toán thành công?"
              onConfirm={() => handleReceiveOrder(record._id)}
              okText="Xác nhận"
              cancelText="Hủy"
            >
              <Button type="primary" ghost color="green" icon={<CheckCircleOutlined />} size="small">
                Đã nhận hàng
              </Button>
            </Popconfirm>
          );
        }
        return <Tag color="Brown" className="ml-1">Hoàn thành</Tag>;
      }
    }
  ];

 return (
    <Card className="shadow-sm rounded-lg border border-gray-100">
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">        
        <Title level={4} style={{ margin: 0 }}>
            <ClockCircleOutlined style={{ marginRight: '8px' }} />
            Lịch sử đơn hàng của tôi
        </Title>

        {!isMobile ? (
          <Space direction="horizontal" wrap size="small">
            <Input.Search
              placeholder="Nhập mã đơn cần tìm..."
              allowClear
              style={{ width: 200 }}
              onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
            />

            <DatePicker 
              placeholder="Chọn ngày mua"
              style={{ width: 150 }}
              onChange={(date, dateString) => setFilters(prev => ({ ...prev, date: dateString || undefined }))}
            />

            
            <Input 
              placeholder="Lọc Tỉnh/Thành..." 
              allowClear
              style={{ width: 150 }}
              onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
            />

            <Select
              placeholder="Phương thức thanh toán"
              style={{ width: 160 }}
              allowClear
              onChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}
            >
              {paymentMethods.map(method => (
                <Option key={method} value={method}>
                  {method === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản (BANK)'}
                </Option>
              ))}
            </Select>

           <Select
            placeholder="Lọc trạng thái"
            style={{ width: 140 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            {statuses.map(status => (
              <Option key={status} value={status}>{status}</Option>
            ))}
          </Select>
        </Space>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => setFilterDrawerOpen(true)}>Bộ lọc</Button>
          </div>
        )}
      </div>

      <Drawer title="Bộ lọc" placement="bottom" onClose={() => setFilterDrawerOpen(false)} open={filterDrawerOpen} height={360}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.Search placeholder="Nhập mã đơn cần tìm..." allowClear onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))} />
          <DatePicker placeholder="Chọn ngày mua" style={{ width: '100%' }} onChange={(date, dateString) => setFilters(prev => ({ ...prev, date: dateString || undefined }))} />
          <Input placeholder="Lọc Tỉnh/Thành..." allowClear onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))} />
          <Select placeholder="Phương thức thanh toán" allowClear onChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}>
            {paymentMethods.map(method => <Option key={method} value={method}>{method === 'COD' ? 'Tiền mặt (COD)' : 'Chuyển khoản (BANK)'}</Option>)}
          </Select>
          <Select placeholder="Lọc trạng thái" allowClear onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
            {statuses.map(status => <Option key={status} value={status}>{status}</Option>)}
          </Select>
        </Space>
      </Drawer>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(order => (
            <Card key={order._id} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{order.orderId}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(order.createdAt).toLocaleString('vi-VN')}</div>
                  <div style={{ marginTop: 6 }}><strong>Tổng:</strong> <span style={{ color: '#d32f2f' }}>{order.totalPrice?.toLocaleString()} VNĐ</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color="blue">{order.status}</Tag>
                  </div>
                  <Button type="link" onClick={() => { window.location.href = `/orders/${order._id}`; }}>Chi tiết</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table 
          dataSource={orders} 
          columns={columns} 
          rowKey="_id"
          loading={loading}
        />
      )}
    </Card>
  );
};

export default UserOrders;