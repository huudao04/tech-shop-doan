import React, { useEffect, useState } from 'react';
import { Table, Switch, message, Tag, Space, Card, Typography } from 'antd';
import { UserOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Lấy danh sách khách hàng từ API
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể tải danh sách người dùng!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Xử lý bật tắt trạng thái hoạt động (Khóa / Mở khóa)
  const handleToggleStatus = async (checked, record) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `http://localhost:5000/api/admin/customers/${record._id}/toggle-status`,
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
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Quản lý tài khoản khách hàng</Title>
        <span style={{ color: '#8c8c8c' }}>Danh sách người dùng đăng ký tài khoản mua sắm tại hệ thống TechShop</span>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: 'Chưa có tài khoản khách hàng nào đăng ký' }}
      />
    </Card>
  );
};

export default AdminUsers;