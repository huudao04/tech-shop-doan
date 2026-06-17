import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Switch, Space, Modal, Form, InputNumber, DatePicker, Popconfirm, message, Tag, Card, Row, Col } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const AdminVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Bộ lọc tìm kiếm nâng cao khớp BE query
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [isActiveFilter, setIsActiveFilter] = useState(undefined);
  
  // Bổ sung State lọc thời gian độc lập
  const [filterStartDate, setFilterStartDate] = useState(null);
  const [filterEndDate, setFilterEndDate] = useState(null);

  // Trạng thái cho Modal Form (Thêm/Sửa)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  // 1. Tải danh sách mã giảm giá từ Backend
  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (isActiveFilter) params.isActive = isActiveFilter;

      // Xử lý giữ nguyên múi giờ Việt Nam (+07:00) khi gửi lên Server
      if (filterStartDate) {
        params.startDate = dayjs(filterStartDate).startOf('day').format('YYYY-MM-DDTHH:mm:ss.SSS') + '+07:00';
      }
      if (filterEndDate) {
        params.endDate = dayjs(filterEndDate).endOf('day').format('YYYY-MM-DDTHH:mm:ss.SSS') + '+07:00';
      }

      const response = await API.get('/api/vouchers', { params });
      if (response.data.success) {
        setVouchers(response.data.data);
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể tải danh sách mã giảm giá');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [statusFilter, isActiveFilter, filterStartDate, filterEndDate]); // Tự động gọi lại API khi thay đổi bộ lọc ngày tháng

  // 2. Xử lý Bật/Tắt nhanh trạng thái isActive bằng Switch trên Table
  const handleToggleActive = async (id, currentStatus) => {
    try {
      const response = await API.put(`/api/vouchers/${id}`, { isActive: !currentStatus });
      if (response.data.success) {
        message.success('Thay đổi trạng thái mã thành công');
        fetchVouchers();
      }
    } catch (error) {
      message.error('Không thể cập nhật trạng thái hoạt động');
    }
  };

  // 3. Xử lý xóa mã giảm giá
  const handleDelete = async (id) => {
    try {
      const response = await API.delete(`/api/vouchers/${id}`);
      if (response.data.success) {
        message.success('Đã xóa mã giảm giá hoàn toàn');
        fetchVouchers();
      }
    } catch (error) {
      message.error('Xóa thất bại');
    }
  };

  // 4. Mở Modal ở chế độ tạo mới hoặc sửa mã
  const openModal = (record = null) => {
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue({
        code: record.code,
        discountValue: record.discountValue,
        minOrderValue: record.minOrderValue,
        usageLimit: record.usageLimit,
        dates: [dayjs(record.startDate), dayjs(record.endDate)],
        isActive: record.isActive
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  // 5. Submit dữ liệu của Form (Tạo mới hoặc Sửa)
  const handleFormSubmit = async (values) => {
    try {
      const payload = {
        code: values.code,
        discountValue: values.discountValue,
        minOrderValue: values.minOrderValue || 0,
        usageLimit: values.usageLimit,
        startDate: values.dates[0].toISOString(),
        endDate: values.dates[1].toISOString(),
        isActive: values.isActive !== undefined ? values.isActive : true
      };

      if (editingId) {
        // Chế độ Cập nhật
        const response = await API.put(`/api/vouchers/${editingId}`, payload);
        if (response.data.success) message.success('Cập nhật cấu hình mã thành công');
      } else {
        // Chế độ Tạo mới
        const response = await API.post('/api/vouchers', payload);
        if (response.data.success) message.success('Tạo mã giảm giá mới thành công');
      }
      setIsModalOpen(false);
      fetchVouchers();
    } catch (error) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu!');
    }
  };

  // Cấu hình các cột hiển thị của bảng dữ liệu
  const columns = [
    {
      title: 'Mã giảm giá',
      dataIndex: 'code',
      key: 'code',
      render: (text) => <Tag color="cyan" style={{ fontWeight: 700, fontSize: 13 }}>{text}</Tag>
    },
    {
      title: 'Số tiền giảm',
      dataIndex: 'discountValue',
      key: 'discountValue',
      render: (val) => <b style={{ color: '#2ecc71' }}>{val.toLocaleString()}đ</b>
    },
    {
      title: 'Đơn tối thiểu',
      dataIndex: 'minOrderValue',
      key: 'minOrderValue',
      render: (val) => <span>{val ? `${val.toLocaleString()}đ` : '0đ'}</span>
    },
    {
      title: 'Lượt sử dụng',
      key: 'usage',
      render: (_, record) => (
        <span>{record.usedCount} / <b>{record.usageLimit}</b></span>
      )
    },
    {
      title: 'Thời gian áp dụng',
      key: 'duration',
      render: (_, record) => {
        const start = dayjs(record.startDate).format('DD/MM/YYYY');
        const end = dayjs(record.endDate).format('DD/MM/YYYY');
        return <span style={{ fontSize: 12 }}>{start} - {end}</span>;
      }
    },
    {
      title: 'Hiệu lực thực tế',
      key: 'realtimeStatus',
      render: (_, record) => {
        const now = dayjs();
        if (now.isBefore(dayjs(record.startDate))) return <Tag color="blue">Sắp diễn ra</Tag>;
        if (now.isAfter(dayjs(record.endDate))) return <Tag color="red">Hết hạn sử dụng</Tag>;
        return <Tag color="green">Đang kích hoạt</Tag>;
      }
    },
    {
      title: 'Kích hoạt',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive, record) => (
        <Switch 
          checked={isActive} 
          onChange={() => handleToggleActive(record._id, isActive)} 
        />
      )
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" className='btn-action' icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openModal(record)} />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa mã giảm giá này?"
            onConfirm={() => handleDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger className='btn-action' icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title={<span style={{ fontSize: '20px', fontWeight: 700 }}>QUẢN LÝ MÃ GIẢM GIÁ (VOUCHERS)</span>}>
        
        {/* THANH ĐIỀU HƯỚNG TÌM KIẾM & BỘ LỌC */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <Space size="middle" style={{ flexWrap: 'wrap' }}>
            <Input
              placeholder="Tìm mã giảm giá..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={fetchVouchers}
              style={{ width: 180 }}
            />
            <Button type="primary" onClick={fetchVouchers}>Tìm kiếm</Button>

            <Select
              placeholder="Tình trạng thời hạn"
              allowClear
              style={{ width: 150 }}
              onChange={(val) => setStatusFilter(val)}
            >
              <Select.Option value="active">Đang hiệu lực</Select.Option>
              <Select.Option value="upcoming">Sắp diễn ra</Select.Option>
              <Select.Option value="expired">Đã quá hạn</Select.Option>
            </Select>

            <Select
              placeholder="Bộ lọc trạng thái"
              allowClear
              style={{ width: 150 }}
              onChange={(val) => setIsActiveFilter(val)}
            >
              <Select.Option value="true">Bật kích hoạt</Select.Option>
              <Select.Option value="false">Tắt kích hoạt</Select.Option>
            </Select>

            {/* BỔ SUNG: Ô CHỌN THỜI GIAN ĐỘC LẬP THEO GIỜ VIỆT NAM */}
            <DatePicker 
              placeholder="Từ ngày áp dụng" 
              format="DD/MM/YYYY"
              value={filterStartDate}
              onChange={(date) => setFilterStartDate(date)}
              style={{ width: 150 }}
              allowClear
            />
            <DatePicker 
              placeholder="Đến ngày áp dụng" 
              format="DD/MM/YYYY"
              value={filterEndDate}
              onChange={(date) => setFilterEndDate(date)}
              style={{ width: 150 }}
              allowClear
            />
          </Space>

          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            Tạo Voucher mới
          </Button>
        </div>

        {/* BẢNG HIỂN THỊ */}
        <Table
          columns={columns}
          dataSource={vouchers}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      {/* MODAL THÊM / SỬA VOUCHER */}
      <Modal
        title={editingId ? "CẬP NHẬT MÃ GIẢM GIÁ" : "THÊM MÃ GIẢM GIÁ MỚI"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleFormSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label="Ký hiệu mã giảm giá (Code)"
            rules={[{ required: true, message: 'Vui lòng nhập ký hiệu viết liền' }]}
          >
            <Input placeholder="Ví dụ: GIAM20K, CONGNGHE500" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="discountValue"
                label="Số tiền giảm (VNĐ)"
                rules={[{ required: true, message: 'Vui lòng điền số tiền giảm' }]}
              >
                <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\$\s?|(,*)/g, '')} min={1000} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="minOrderValue"
                label="Đơn tối thiểu áp dụng (VNĐ)"
              >
                <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\$\s?|(,*)/g, '')} min={0} placeholder="Bỏ trống nếu bằng 0đ" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="usageLimit"
                label="Tổng giới hạn lượt dùng"
                rules={[{ required: true, message: 'Nhập tổng số lượt phát hành' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="Ví dụ: 50" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isActive"
                label="Trạng thái kích hoạt"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="dates"
            label="Thời hạn áp dụng (Thời gian bắt đầu - Kết thúc)"
            rules={[{ required: true, message: 'Vui lòng cấu hình khung ngày hiệu lực!' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={['Ngày bắt đầu', 'Ngày hết hạn']} />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
              <Button type="primary" htmlType="submit">Lưu lại</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminVouchers;