import React, { useEffect, useState } from 'react';
import { Table, Button, Rate, Space, Avatar, message, Popconfirm, Card, Typography, Modal, Form, Input, Select, DatePicker } from 'antd';
import { DeleteOutlined, CommentOutlined, PlusOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';
import { getImageUrl } from '../utils/imageUrl.js';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]); // Danh sách sản phẩm để chọn khi tạo/sửa fake review
  const [loading, setLoading] = useState(false);

  const [ratingOptions, setRatingOptions] = useState([]);
  const [filters, setFilters] = useState({
    searchCustomer: '',
    productId: undefined,
    rating: undefined,
    date: undefined
  });

  // Các trạng thái đóng mở modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  
  const [editingReview, setEditingReview] = useState(null); // Review đang chọn để sửa hoặc phản hồi
  const [form] = Form.useForm();
  const [replyForm] = Form.useForm();

  // 🌟 Call API độc lập lấy danh sách Số sao từ collection ratings thô
  const fetchRatingsMetadata = async () => {
    try {
      const res = await API.get('/api/admin/reviews/ratings');
      if (res.data.success) {
        setRatingOptions(res.data.data);
      }
    } catch (error) {
      console.error("Không thể tải cấu hình số sao:", error);
    }
  };
  // 🌟 Call API độc lập lấy danh sách sản phẩm để chọn khi tạo/sửa fake review
  const fetchProducts = async () => {
    try {
      const response = await API.get('/api/products');
      setProducts(response.data.products || response.data);
    } catch (error) {
      console.error('Lỗi lấy danh sách sản phẩm:', error);
    }
  };

  // Lấy danh sách review kèm theo truyền tham số bộ lọc lên Backend
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.searchCustomer) params.searchCustomer = filters.searchCustomer;
      if (filters.productId) params.productId = filters.productId;
      if (filters.rating) params.rating = filters.rating;
      if (filters.date) params.date = filters.date;

      const response = await API.get('/api/admin/reviews', { params });
      setReviews(response.data);
    } catch (error) {
      console.error('Lỗi lấy danh sách đánh giá:', error);
      message.error('Không thể tải danh sách đánh giá!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchRatingsMetadata();
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [filters]);

  // 2. Xóa phản hồi/đánh giá
  const handleDelete = async (id) => {
    try {
      const response = await API.delete(`/api/admin/reviews/${id}`);
      if (response.data.success) {
        message.success('Đã xóa phản hồi thành công!');
        setReviews(reviews.filter((review) => review._id !== id));
      }
    } catch (error) {
      console.error('Lỗi xóa đánh giá:', error);
      message.error('Xóa phản hồi thất bại, vui lòng thử lại!');
    }
  };

  // 3. Mở modal thêm hoặc sửa review
  const openReviewModal = (record = null) => {
    setEditingReview(record);
    if (record) {
      form.setFieldsValue({
        productId: record.productId?._id,
        name: record.name,
        rating: record.rating,
        comment: record.comment,
      });
    } else {
      form.resetFields();
    }
    setIsReviewModalOpen(true);
  };

  // 4. Submit dữ liệu Thêm / Sửa review
  const handleReviewSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingReview) {
        // Trường hợp SỬA
        const response = await API.put(`/api/admin/reviews/${editingReview._id}`, values);
        if (response.data.success) {
          message.success('Cập nhật đánh giá thành công!');
          setReviews(reviews.map(item => item._id === editingReview._id ? response.data.review : item));
        }
      } else {
        // Trường hợp THÊM MỚI
        const response = await API.post('/api/admin/reviews', values);
        if (response.data.success) {
          message.success('Thêm đánh giá fake thành công!');
          setReviews([response.data.review, ...reviews]);
        }
      }
      setIsReviewModalOpen(false);
    } catch (error) {
      console.error('Lỗi submit form review:', error);
    }
  };

  // 5. Mở modal phản hồi review của người dùng
  const openReplyModal = (record) => {
    setEditingReview(record);
    replyForm.setFieldsValue({ reply: record.reply || '' });
    setIsReplyModalOpen(true);
  };

  // Thay đổi hàm submit phản hồi từ Admin ở AdminReviews.jsx sang cấu trúc mới
const handleReplySubmit = async () => {
  try {
    const values = await replyForm.validateFields();
    // Thay đổi từ PATCH /reply cũ sang POST gửi trao đổi thảo luận chung mới
    const response = await API.post(`/api/reviews/${editingReview._id}/discussion`, { comment: values.reply });
    if (response.data.success) {
      message.success('Đã gửi phản hồi vào chuỗi thảo luận thành công!');
      
      // Đồng bộ lại UI state của Admin table
      setReviews(reviews.map(item => item._id === editingReview._id ? { ...item, discussions: response.data.review.discussions } : item));
      setIsReplyModalOpen(false);
      replyForm.resetFields();
    }
  } catch (error) {
    console.error('Lỗi phản hồi phía Admin:', error);
    message.error('Không thể gửi phản hồi!');
  }
};

  // Cấu hình các cột hiển thị bảng Antd
  const columns = [
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (text) => <Text strong className="text-gray-800">{text}</Text>,
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'productId',
      key: 'product',
      width: 230,
      render: (productId) => {
        if (!productId) return <Text type="secondary">Sản phẩm không tồn tại</Text>;
        return (
          <Space>
            <Avatar 
              src={getImageUrl(productId.image, 'https://via.placeholder.com/40')} 
              shape="square" 
              size={40} 
              alt={productId.name}
              fallback="https://via.placeholder.com/40"
            />
            <Text className="font-medium text-gray-700 line-clamp-2">{productId.name}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Đánh giá',
      dataIndex: 'rating',
      key: 'rating',
      width: 140,
      sorter: (a, b) => a.rating - b.rating,
      render: (rating) => <Rate disabled defaultValue={rating} className="text-sm text-amber-400" />,
    },
    {
      title: 'Nội dung bình luận & Thảo luận',
      key: 'content_section',
      render: (_, record) => (
        <div className="space-y-2">
          <p className="text-gray-800 font-medium m-0 whitespace-pre-wrap">{record.comment}</p>
          
          {/* Duyệt mảng các phản hồi trao đổi nếu có */}
          {record.discussions && record.discussions.length > 0 && (
            <div className="bg-gray-50 border-l-2 border-blue-400 p-2 rounded text-xs space-y-1">
              <Text strong className="text-blue-600 block">LỊCH SỬ TRAO ĐỔI QUA LẠI ({record.discussions.length}):</Text>
              {record.discussions.map((d, i) => (
                <div key={i} className="text-gray-600">
                  <span className="font-bold">{d.name} ({d.role === 'admin' ? 'Admin' : 'Khách'}):</span> {d.comment}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (date) => new Date(date).toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size="middle">
          {/* Nút Phản hồi */}
          <Button 
            type="text" 
            icon={<CommentOutlined className="text-emerald-600" />} 
            onClick={() => openReplyModal(record)}
            title="Phản hồi đánh giá"
            className="hover:bg-emerald-50"
          />
          {/* Nút Sửa */}
          <Button 
            type="text" 
            icon={<EditOutlined className="text-blue-600" />} 
            onClick={() => openReviewModal(record)}
            title="Sửa đánh giá"
            className="hover:bg-blue-50"
          />
          {/* Nút Xóa */}
          <Popconfirm
            title="Xóa phản hồi"
            description="Bạn có chắc chắn muốn xóa vĩnh viễn bình luận này không?"
            onConfirm={() => handleDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              className="hover:bg-red-50"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <Title level={3} style={{ margin: 10 }}>Quản lý Đánh giá & Phản hồi</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          className="bg-emerald-500 hover:bg-emerald-600 border-none rounded-md "
          style={{ marginLeft: '10px' }}
          onClick={() => openReviewModal(null)}
        >
          Thêm Đánh Giá
        </Button>
      </div>

      <Card className="mb-4 shadow-sm" bodyStyle={{ padding: '12px 16px' }}>
        <Space direction="horizontal" wrap size="small">
          
          <Input.Search
            placeholder="Tìm tên khách hàng..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 220 }}
            onSearch={(value) => setFilters(prev => ({ ...prev, searchCustomer: value }))}
          />

          <Select
            placeholder="Chọn lọc theo sản phẩm"
            style={{ width: 250 }}
            allowClear
            showSearch
            optionFilterProp="children"
            onChange={(value) => setFilters(prev => ({ ...prev, productId: value }))}
          >
            {products.map(p => (
              <Option key={p._id} value={p._id}>{p.name}</Option>
            ))}
          </Select>

          <Select
            placeholder="Lọc số sao (Rating)"
            style={{ width: 180 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}
          >
            {/* 🌟 Vòng lặp map tự động đổ dữ liệu số sao lấy từ API ratings thô */}
            {ratingOptions.map(rate => (
              <Option key={rate.value} value={rate.value}>{rate.label}</Option>
            ))}
          </Select>

          <DatePicker 
            placeholder="Chọn ngày gửi đánh giá"
            style={{ width: 180 }}
            onChange={(date, dateString) => setFilters(prev => ({ ...prev, date: dateString || undefined }))}
          />
        </Space>
      </Card>

      {/* Khối Bảng dữ liệu chính */}
      <Card className="shadow-sm border-gray-100 rounded-lg">
        <Table
          columns={columns}
          dataSource={reviews}
          rowKey={(record) => record._id}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            locale: { items_per_page: '/ trang' }
          }}
          className="border-none"
        />
      </Card>

      {/* ─── MODAL: THÊM / SỬA REVIEW FAKE ─── */}
      <Modal
        title={editingReview ? "Chỉnh sửa đánh giá" : "Tạo đánh giá mới (Fake Review)"}
        open={isReviewModalOpen}
        onOk={handleReviewSubmit}
        onCancel={() => setIsReviewModalOpen(false)}
        okText={editingReview ? "Cập nhật" : "Tạo mới"}
        cancelText="Hủy bỏ"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="productId"
            label="Chọn sản phẩm công nghệ"
            rules={[{ required: true, message: 'Vui lòng chọn sản phẩm!' }]}
          >
            <Select placeholder="Tìm hoặc chọn sản phẩm..." showSearch optionFilterProp="children">
              {products.map(prod => (
                <Select.Option key={prod._id} value={prod._id}>{prod.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên người mua (Fake)"
            rules={[{ required: true, message: 'Vui lòng điền tên người đánh giá!' }]}
          >
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="rating"
            label="Số sao đánh giá"
            rules={[{ required: true, message: 'Vui lòng chọn mức độ hài lòng!' }]}
          >
            <Rate className="text-amber-400" />
          </Form.Item>

          <Form.Item
            name="comment"
            label="Nội dung review"
            rules={[{ required: true, message: 'Nội dung bình luận không được trống!' }]}
          >
            <TextArea rows={4} placeholder="Nhập cảm nghĩ sản phẩm..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── MODAL: PHẢN HỒI (REPLY) REVIEW CỦA KHÁCH ─── */}
      <Modal
        title="Phản hồi bình luận khách hàng"
        open={isReplyModalOpen}
        onOk={handleReplySubmit}
        onCancel={() => setIsReplyModalOpen(false)}
        okText="Gửi phản hồi"
        cancelText="Hủy"
        okButtonProps={{ className: 'bg-emerald-500 hover:bg-emerald-600 border-none' }}
      >
        <div className="bg-gray-50 p-3 rounded-md mb-4 mt-2">
          <p className="text-xs text-gray-400 m-0">Khách hàng: <Text strong>{editingReview?.name}</Text></p>
          <p className="text-sm text-gray-700 mt-1 mb-0 italic">"{editingReview?.comment}"</p>
        </div>
        <Form form={replyForm} layout="vertical">
          <Form.Item
            name="reply"
            label="Nội dung phản hồi từ cửa hàng"
            rules={[{ required: true, message: 'Vui lòng không bỏ trống lời phản hồi!' }]}
          >
            <TextArea rows={4} placeholder="Chào bạn, cảm ơn bạn đã tin tưởng TechShop..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminReviews;