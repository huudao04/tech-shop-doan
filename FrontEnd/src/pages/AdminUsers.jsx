import React, { useEffect, useState } from 'react';
import { Table, Switch, message, Tag, Space, Card, Typography, Input, Select, DatePicker } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';

const { Title } = Typography;
const { Option } = Select;

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accountStatuses, setAccountStatuses] = useState([]);
  
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    date: undefined
  });

  const fetchStatusesMetadata = async () => {
    try {
      const res = await API.get('/api/admin/customers/statuses');
      if (res.data.success) {
        setAccountStatuses(res.data.data);
      }
    } catch (error) {
      console.error("Lỗi khi gọi danh sách trạng thái user:", error);
    }
  };

  // Lấy danh sách khách hàng từ API
 const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.date) params.date = filters.date;

      const response = await API.get('/api/admin/customers', { params });
      setUsers(response.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể tải danh sách người dùng!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusesMetadata();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [filters]);

  // Xử lý bật tắt trạng thái hoạt động (Khóa / Mở khóa)
  const handleToggleStatus = async (checked, record) => {
    try {
      const token = localStorage.getItem('token');
      const response = await API.patch(
        `/api/admin/customers/${record._id}/toggle-status`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        message.success(response.data.message);
        // Cập nhật lại state local để không phải gọi lại API toàn bộ danh sách
        setUsers(users.map(u => u._id === record._id ? { ...u, isActive: checked } : u));
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Thao tác thất bại!');
    }
  };

  // Cấu hình các cột của bảng Ant Design
  const columns = [
    {
      title: 'Họ và tên',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span><UserOutlined style={{ marginRight: 8 }} />{text}</span>,
    },
    {
      title: 'Email tài khoản',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        isActive ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>Đang hoạt động</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>Đã khóa</Tag>
        )
      ),
    },
    {
      title: 'Hành động (Cho phép đăng nhập)',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Switch
            checkedChildren="Mở"
            unCheckedChildren="Khóa"
            checked={record.isActive}
            onChange={(checked) => handleToggleStatus(checked, record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <Card bordered={false}>
      <div style={{ marginBottom: 24 }} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div style={{ marginBottom: 8 }}>
          <Title level={3} style={{ margin: 0 }}>Quản lý tài khoản khách hàng</Title>
          <span style={{ color: '#8c8c8c' }}>Danh sách người dùng đăng ký tài khoản mua sắm tại hệ thống TechShop</span>
        </div>

        <Space direction="horizontal" wrap size="small">
          <Input.Search
            placeholder="Tìm theo tên hoặc email..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 250 }}
            onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
          />

          <DatePicker 
            placeholder="Chọn ngày đăng ký"
            style={{ width: 170 }}
            onChange={(date, dateString) => setFilters(prev => ({ ...prev, date: dateString || undefined }))}
          />

          <Select
            placeholder="Lọc trạng thái tài khoản"
            style={{ width: 200 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            {/* 🌟 Đổ dữ liệu động lấy trực tiếp từ API độc lập */}
            {accountStatuses.map(status => (
              <Option key={status.value} value={status.value}>{status.label}</Option>
            ))}
          </Select>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={users} 
        rowKey="_id" 
        loading={loading}
      />
    </Card>
  );
};

export default AdminUsers;