import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Tabs, Modal } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode'; 
import API from '../utils/axiosClient';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  
  const navigate = useNavigate();
  const [formLogin] = Form.useForm();
  const [formRegister] = Form.useForm();
  const [formForgot] = Form.useForm();

  // Xử lý khi bấm Đăng nhập thông thường
  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/api/auth/login', values);
      if (response.data.success) {
        message.success('Đăng nhập hệ thống thành công!');
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        window.dispatchEvent(new Event('auth-change'));

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

  // Xử lý Đăng nhập bằng Google thành công
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // Giải mã gói token Google trả ra để lấy email và tên hiển thị công khai
      const decoded = jwtDecode(credentialResponse.credential);
      
      const response = await API.post('/api/auth/google-login', {
        email: decoded.email,
        name: decoded.name
      });

      if (response.data.success) {
        message.success('Đăng nhập bằng Google thành công!');
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        window.dispatchEvent(new Event('auth-change'));

        if (response.data.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Đăng nhập Google thất bại!');
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
        formRegister.resetFields();
        setActiveTab('login');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Đăng ký thất bại, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý yêu cầu Quên mật khẩu
  const handleForgotPassword = async (values) => {
    setForgotLoading(true);
    try {
      const response = await API.post('/api/auth/forgot-password', { email: values.email });
      if (response.data.success) {
        message.success(response.data.message);
        setIsForgotModalOpen(false);
        formForgot.resetFields();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Gửi yêu cầu thất bại, vui lòng thử lại!');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    // Bọc trong GoogleOAuthProvider (Lấy Client ID từ Google Cloud Console)
    <GoogleOAuthProvider clientId="838155976083-9neeovmm0n6b3f5qs05l7tq7s1nuc5a0.apps.googleusercontent.com">
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

                    <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                      <Button type="link" onClick={() => setIsForgotModalOpen(true)} style={{ padding: 0 }}>
                        Quên mật khẩu?
                      </Button>
                    </div>

                    <Form.Item>
                      <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ height: '45px', fontSize: '16px', fontWeight: '500', borderRadius: '6px' }}>
                        Đăng nhập
                      </Button>
                    </Form.Item>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '15px', gap: '10px' }}>
                      <span style={{ color: '#8c8c8c' }}>Hoặc đăng nhập bằng</span>
                      {/* Nút Đăng nhập Google nguyên bản của Ant/Google */}
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => message.error('Đăng nhập Google thất bại!')}
                        useOneTap
                      />
                    </div>
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

        {/* MODAL NHẬP EMAIL QUÊN MẬT KHẨU */}
        <Modal
          title="Quên mật khẩu tài khoản"
          open={isForgotModalOpen}
          onCancel={() => { setIsForgotModalOpen(false); formForgot.resetFields(); }}
          footer={null}
        >
          <Form form={formForgot} layout="vertical" onFinish={handleForgotPassword} style={{ marginTop: '15px' }}>
            <Form.Item
              name="email"
              label="Nhập địa chỉ Email của tài khoản"
              rules={[{ required: true, type: 'email', message: 'Vui lòng nhập đúng định dạng Email!' }]}
            >
              <Input placeholder="example@gmail.com" size="large" />
            </Form.Item>
            <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
              <Button onClick={() => setIsForgotModalOpen(false)} style={{ marginRight: '8px' }}>Hủy bỏ</Button>
              <Button type="primary" htmlType="submit" loading={forgotLoading}>Gửi liên kết khôi phục</Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;