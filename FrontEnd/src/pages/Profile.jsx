import React, { useState } from 'react';
import { Card, Descriptions, Badge, Avatar, Button, Space, Divider, Modal, Form, Input, message } from 'antd';
import { UserOutlined, KeyOutlined, ArrowLeftOutlined, SolutionOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Profile = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // Đọc thông tin người dùng từ localStorage
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h3>Vui lòng đăng nhập để xem thông tin này!</h3>
        <Button type="primary" onClick={() => navigate('/login')}>Đăng nhập ngay</Button>
      </div>
    );
  }

  // Xử lý gửi dữ liệu đổi mật khẩu lên Backend
  const handleChangePassword = async (values) => {
    setLoading(true);
    try {
      const response = await axios.put(
        'http://localhost:5000/api/auth/change-password', 
        {
          oldPassword: values.oldPassword,
          newPassword: values.newPassword
        },
        {
          headers: {
            Authorization: `Bearer ${token}` // Gửi token lên để backend xác thực
          }
        }
      );

      if (response.data.success) {
        message.success(response.data.message);
        setIsModalOpen(false);
        form.resetFields();
        
        // Đăng xuất và đẩy người dùng về trang login buộc họ đăng nhập lại với pass mới
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/login';
        }, 1500);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại!';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0' }}>
      <Button 
        type="link" 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)} 
        style={{ marginBottom: 16, padding: 0 }}
      >
        Quay lại
      </Button>

      <Card 
        bordered={false} 
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '30px' }}>
          <Avatar 
            size={80} 
            style={{ backgroundColor: user.role === 'admin' ? '#f5222d' : '#1677ff' }} 
            icon={<UserOutlined />} 
          />
          <div>
            <h2 style={{ margin: '0 0 8px 0' }}>{user.name}</h2>
            <Space size="middle">
              {user.role === 'admin' ? (
                <Badge color="red" text="Quản trị viên (Admin)" style={{ fontWeight: 'bold' }} />
              ) : (
                <Badge color="blue" text="Khách hàng thành viên" />
              )}
            </Space>
          </div>
        </div>

        <Divider orientation="left" style={{ borderColor: '#f0f0f0' }}>Thông tin tài khoản</Divider>

        <Descriptions column={1} bordered size="middle" labelStyle={{ width: '200px', fontWeight: 'bold', background: '#fafafa' }}>
          <Descriptions.Item label="Mã định danh (ID)">
            <span style={{ fontFamily: 'monospace', color: '#555' }}>{user.id}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Họ và tên">
            {user.name}
          </Descriptions.Item>
          <Descriptions.Item label="Địa chỉ Email">
            {user.email}
          </Descriptions.Item>
          <Descriptions.Item label="Quyền hạn trên hệ thống">
            <span style={{ textTransform: 'uppercase', fontWeight: 600, color: user.role === 'admin' ? '#d32f2f' : '#1976d2' }}>
              {user.role}
            </span>
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {user.role === 'admin' && (
            <Button 
              type="primary" 
              danger 
              icon={<SolutionOutlined />} 
              onClick={() => navigate('/admin')}
            >
              Vào bảng điều khiển Admin
            </Button>
          )}
          <Button 
            type="primary"
            icon={<KeyOutlined />} 
            onClick={() => setIsModalOpen(true)}
          >
            Đổi mật khẩu
          </Button>
        </div>
      </Card>

      {/* ================= MODAL ĐỔI MẬT KHẨU ================= */}
      <Modal
        title={<div><LockOutlined style={{ marginRight: 8, color: '#1677ff' }} /> Đổi mật khẩu tài khoản</div>}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="oldPassword"
            label="Mật khẩu hiện tại"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu cũ!' }]}
          >
            <Input.Password placeholder="Nhập mật khẩu cũ" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
              { min: 6, message: 'Mật khẩu mới phải từ 6 ký tự trở lên!' }
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu mới" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận lại mật khẩu mới!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsModalOpen(false); form.resetFields(); }}>
                Hủy bỏ
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Cập nhật
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile;