import React, { useState, useEffect } from 'react';
import { Table, Button, Typography, Modal, Form, Input, InputNumber, Select, message, Space, Upload, Popconfirm, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';

const { Title } = Typography;

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // Danh mục từ collection categories
  const [brands, setBrands] = useState([]);         // Thương hiệu từ collection brands
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); 
  const [fileList, setFileList] = useState([]); // Quản lý file ảnh đang chọn trên giao diện Form
  const [form] = Form.useForm();

  const [filters, setFilters] = useState({
    search: '',
    category: undefined,
    brand: undefined,
    minPrice: undefined,
    maxPrice: undefined
  });

  // Hàm lấy danh sách sản phẩm từ MongoDB
  const fetchProducts = async () => {
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.brand) params.brand = filters.brand;
      if (filters.minPrice !== undefined && filters.minPrice !== null) params.minPrice = filters.minPrice;
      if (filters.maxPrice !== undefined && filters.maxPrice !== null) params.maxPrice = filters.maxPrice;

      const res = await API.get('/api/products', { params });
      setProducts(res.data);
    } catch (error) {
      message.error('Không thể tải danh sách sản phẩm');
    }
  };

  // Hàm gọi API lấy danh mục và thương hiệu động từ DB đổ vào ô Select
  const fetchMetadata = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        API.get('/api/categories'),
        API.get('/api/brands')
      ]);
      setCategories(catRes.data);
      setBrands(brandRes.data);
    } catch (error) {
      message.error('Không thể tải cấu hình danh mục hoặc thương hiệu');
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [filters]);

  // Mở modal khi bấm nút "Thêm sản phẩm"
  const handleAddClick = () => {
    setEditingProduct(null); 
    setFileList([]); // Xóa sạch ảnh cũ lưu trong Form
    form.resetFields();
    setIsModalOpen(true);
  };

  // Mở modal và nạp dữ liệu cũ khi bấm nút "Sửa"
  const handleEditClick = (record) => {
    setEditingProduct(record);
    form.setFieldsValue(record); 
    
    // Kiểm tra nếu sản phẩm có mảng ảnh
  if (record.image && Array.isArray(record.image)) {
    const formattedFiles = record.image.map((imgName, index) => ({
      uid: index.toString(),
      name: imgName,
      status: 'done',
      url: imgName.startsWith('http') ? imgName : `/images/${imgName}`,
      response: { fileName: imgName } // Lưu lại tên file để nhận diện khi submit
    }));
    setFileList(formattedFiles);
  } else {
    setFileList([]);
  }
  setIsModalOpen(true);
};

  const onFinish = async (values) => {
  try {
    let finalImageArray = [];
    const formData = new FormData();
    let hasNewFiles = false;

    // Duyệt qua danh sách file đang có trên giao diện Form
    fileList.forEach(file => {
      if (file.originFileObj) {
        // Nếu là file mới chọn từ máy tính, nhét vào formData để chuẩn bị gửi lên API
        formData.append('imageFiles', file.originFileObj);
        hasNewFiles = true;
      } else if (file.response && file.response.fileName) {
        // Nếu là ảnh cũ đã nằm trên server từ trước, giữ lại tên file
        finalImageArray.push(file.response.fileName);
      } else if (file.name) {
        finalImageArray.push(file.name);
      }
    });

    // 1. Nếu có file ảnh mới, tiến hành gọi API upload
    if (hasNewFiles) {
      const uploadRes = await API.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Gộp các tên file mới được trả về vào mảng chung
      finalImageArray = [...finalImageArray, ...uploadRes.data.fileNames];
    }

    // Đóng gói mảng tên file ảnh vào đối tượng gửi đi lưu trữ
    const productData = { ...values, image: finalImageArray };

    if (editingProduct) {
      await API.put(`/api/products/${editingProduct._id}`, productData);
      message.success('Cập nhật sản phẩm thành công!');
    } else {
      await API.post('/api/products', productData);
      message.success('Thêm sản phẩm thành công!');
    }
    setIsModalOpen(false);
    form.resetFields();
    setFileList([]);
    fetchProducts(); 
  } catch (error) {
    message.error('Có lỗi xảy ra khi xử lý thông tin sản phẩm');
  }
};

  const handleDelete = async (id) => {
    try {
      await API.delete(`/api/products/${id}`);
      message.success('Đã xóa sản phẩm!');
      fetchProducts();
    } catch (error) {
      message.error('Lỗi khi xóa sản phẩm');
    }
  };

  const columns = [
    { 
      title: 'Tên sản phẩm',
      width: 300,
      render: (_, record) => {
        // Lấy ảnh đầu tiên trong mảng làm ảnh đại diện, nếu không có mảng thì check chuỗi cũ
        const mainImage = Array.isArray(record.image) ? record.image[0] : record.image;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src={mainImage?.startsWith('http') ? mainImage : `/images/${mainImage}`}  
                style={{ maxHeight: '40px', maxWidth: '40px', objectFit: 'contain' }}  
                alt={record.name}
              />
            <span className="font-semibold text-gray-800">{record.name}</span> 
          </div>
        );
      }
    },
    { title: 'Thương hiệu', dataIndex: 'brand', key: 'brand' },
    { title: 'Giá (VNĐ)', dataIndex: 'price', key: 'price', render: (val) => val?.toLocaleString() },
    { title: 'Mô tả', dataIndex: 'description', key: 'description' },
    { title: 'Danh mục', dataIndex: 'category', key: 'category' },
    { title: 'Số lượng', dataIndex: 'stock', key: 'stock' },
    { 
      title: 'Hành động', 
      key: 'action', 
      render: (_, record) => (
        <Space size="middle">
          <Button type="primary" ghost icon={<EditOutlined />} onClick={() => handleEditClick(record)}>Sửa</Button>
          <Popconfirm
          title="Xóa sản phẩm"
          description={`Bạn có chắc chắn muốn xóa sản phẩm "${record.name}" không?`}
          onConfirm={() => handleDelete(record._id)} // Nếu ấn Xác nhận thì gọi hàm xóa
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }} // Đổi màu nút Xác nhận thành đỏ cho hợp ngữ cảnh xóa
        >
          <Button danger icon={<DeleteOutlined />}>Xóa</Button>
        </Popconfirm>
        </Space>
      ) 
    },
  ];

  return (
    <div className="p-4">
      {/* Tiêu đề & Nút Thêm giữ nguyên */}
      
      {/* 🌟 3. THANH CÔNG CỤ BỘ LỌC ĐẦY ĐỦ CHO ADMIN */}
      <Card className="mb-4 shadow-sm" bodyStyle={{ padding: '12px 16px' }}>
        <Space direction="horizontal" wrap size="small">
          <Input.Search
            placeholder="Tìm tên sản phẩm..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 210 }}
            onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
          />

          <Select
            placeholder="Lọc theo danh mục"
            style={{ width: 170 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
          >
            {categories.map(c => (
              <Select.Option key={c._id} value={c.name}>{c.name}</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Lọc theo thương hiệu"
            style={{ width: 170 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, brand: value }))}
          >
            {brands.map(b => (
              <Select.Option key={b._id} value={b.name}>{b.name}</Select.Option>
            ))}
          </Select>

          {/* 🌟 Ô Ô NHẬP KHOẢNG GIÁ ĐỘNG */}
          <InputNumber
            placeholder="Giá tối thiểu"
            style={{ width: 140 }}
            min={0}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            onChange={(value) => setFilters(prev => ({ ...prev, minPrice: value }))}
          />
          
          <span style={{ color: '#bfbfbf' }}>-</span>

          <InputNumber
            placeholder="Giá tối đa"
            style={{ width: 140 }}
            min={0}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            onChange={(value) => setFilters(prev => ({ ...prev, maxPrice: value }))}
          />
        </Space>
      </Card>

      <Table dataSource={products} columns={columns} rowKey="_id" />

      <Modal 
        title={editingProduct ? "Chỉnh sửa thông tin sản phẩm" : "Thêm sản phẩm mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Tên sản phẩm" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm!' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Giá" name="price" rules={[{ required: true, message: 'Vui lòng nhập giá tiền!' }]}>
            <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value.replace(/\$\s?|(,*)/g, '')} addonAfter="VNĐ"/>
          </Form.Item>

          <Form.Item label="Thương hiệu" name="brand" rules={[{ required: true, message: 'Vui lòng chọn thương hiệu!' }]}>
            <Select placeholder="Chọn thương hiệu">
              {brands.map(b => (
                <Select.Option key={b._id} value={b.name}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Số lượng trong kho" name="stock">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item label="Danh mục" name="category" rules={[{ required: true, message: 'Vui lòng chọn danh mục!' }]}>
            <Select placeholder="Chọn danh mục">
              {categories.map(c => (
                <Select.Option key={c._id} value={c.name}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* KHUNG CHỌN FILE ẢNH TRỰC QUAN TỪ MÁY TÍNH ADMIN */}
         <Form.Item label="Hình ảnh sản phẩm (Có thể chọn nhiều ảnh)">
            <Upload
              listType="picture-card"
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              beforeUpload={() => false} // Ngăn tự động gửi file, đợi ấn nút Save Form
              multiple={true} // Bật tính năng cho phép chọn nhiều file cùng lúc khi mở cửa sổ máy tính
            >
              {fileList.length < 8 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Chọn file ảnh</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item label="Mô tả sản phẩm" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminProducts;