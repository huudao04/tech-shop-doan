import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '../utils/axiosClient';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const navigate = useNavigate();
  const [formLogin] = Form.useForm();
  const [formRegister] = Form.useForm();

  // Xử lý khi bấm Đăng nhập
  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/api/auth/login', values);
      if (response.data.success) {
        message.success('Đăng nhập hệ thống thành công!');
        
        // Lưu thông tin xác thực vào LocalStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Phân phối điều hướng dựa theo Role của tài khoản
        if (response.data.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Tài khoản hoặc mật khẩu không chính xác!');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý khi bấm Đăng ký tài khoản mới
  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/api/auth/register', {
        name: values.name,
        email: values.email,
        password: values.password
      });

      if (response.data.success) {
        message.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
        formRegister.resetFields(); // Xóa sạch dữ liệu vừa nhập ở form đăng ký
        setActiveTab('login'); // Tự động nhảy về Tab đăng nhập luôn
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Đăng ký thất bại, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card 
        style={{ width: 420, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderRadius: '12px' }}
        title={<h2 style={{ textAlign: 'center', margin: '10px 0 0 0', color: '#1677ff', letterSpacing: '1px' }}>TECH-SHOP</h2>}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={(key) => setActiveTab(key)} 
          centered
          items={[
            {
              key: 'login',
              label: <span style={{ fontSize: '16px', fontWeight: '500' }}>Đăng nhập</span>,
              children: (
                <Form form={formLogin} name="login_form" onFinish={handleLogin} layout="vertical" style={{ marginTop: '10px' }}>
                  <Form.Item name="email" label="Địa chỉ Email" rules={[{ required: true, type: 'email', message: 'Vui lòng nhập đúng định dạng Email!' }]}>
                    <Input prefix={<MailOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="example@gmail.com" size="large" />
                  </Form.Item>

                  <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu đăng nhập!' }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="******" size="large" />
                  </Form.Item>

                  <Form.Item style={{ marginTop: '30px' }}>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ height: '45px', fontSize: '16px', fontWeight: '500', borderRadius: '6px' }}>
                      Đăng nhập
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: <span style={{ fontSize: '16px', fontWeight: '500' }}>Đăng ký</span>,
              children: (
                <Form form={formRegister} name="register_form" onFinish={handleRegister} layout="vertical" style={{ marginTop: '10px' }}>
                  <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ và tên của bạn!' }]}>
                    <Input prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Nguyễn Văn A" size="large" />
                  </Form.Item>

                  <Form.Item name="email" label="Địa chỉ Email" rules={[{ required: true, type: 'email', message: 'Vui lòng nhập đúng định dạng Email!' }]}>
                    <Input prefix={<MailOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="example@gmail.com" size="large" />
                  </Form.Item>

                  <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6, message: 'Mật khẩu phải chứa ít nhất 6 ký tự!' }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)" size="large" />
                  </Form.Item>

                  <Form.Item 
                    name="confirmPassword" 
                    label="Xác nhận mật khẩu" 
                    dependencies={['password']}
                    rules={[
                      { required: true, message: 'Vui lòng xác nhận lại mật khẩu!' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('Mật khẩu nhập lại không trùng khớp!'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Nhập lại mật khẩu" size="large" />
                  </Form.Item>

                  <Form.Item style={{ marginTop: '30px' }}>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ height: '45px', fontSize: '16px', fontWeight: '500', borderRadius: '6px', background: '#52c41a', borderColor: '#52c41a' }}>
                      Đăng ký tài khoản
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default Login;