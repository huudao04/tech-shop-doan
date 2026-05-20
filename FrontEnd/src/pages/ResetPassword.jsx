import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../utils/axiosClient';

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token'); // Trích xuất token từ URL

  const handleResetPassword = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/api/auth/reset-password', {
        token: token,
        newPassword: values.password
      });

      if (response.data.success) {
        message.success('Đặt lại mật khẩu thành công! Hệ thống đang chuyển hướng...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra, liên kết có thể đã hết hạn!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card 
        style={{ width: 400, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderRadius: '12px' }}
        title={<h3 style={{ textAlign: 'center', color: '#1677ff', margin: 0 }}>Tạo Mật Khẩu Mới</h3>}
      >
        <Form layout="vertical" onFinish={handleResetPassword}>
          <Form.Item
            name="password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
              { min: 6, message: 'Mật khẩu phải chứa ít nhất 6 ký tự!' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)" size="large" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận lại mật khẩu!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu nhập lại không khớp!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" size="large" />
          </Form.Item>

          <Form.Item style={{ marginTop: '20px', marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Cập nhật mật khẩu mới
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;