import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Table, Button, Typography, Modal, Form, Input, InputNumber, Select, message, Space, Upload, Popconfirm, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined, DownloadOutlined, UploadOutlined, MenuOutlined } from '@ant-design/icons';
import API from '../utils/axiosClient';
import { getImageUrl } from '../utils/imageUrl.js';

const { Title } = Typography;

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); 
  const [fileList, setFileList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [form] = Form.useForm();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [importedProducts, setImportedProducts] = useState([]);
  const [bulkImagesFileList, setBulkImagesFileList] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    category: undefined,
    brand: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    page: 1,
    limit: 10
  });

  const [totalProducts, setTotalProducts] = useState(0);

  const fetchProducts = async () => {
    try {
      const params = {
        page: filters.page,
        limit: filters.limit
      };
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.brand) params.brand = filters.brand;
      if (filters.minPrice !== undefined && filters.minPrice !== null) params.minPrice = filters.minPrice;
      if (filters.maxPrice !== undefined && filters.maxPrice !== null) params.maxPrice = filters.maxPrice;

      const res = await API.get('/api/products', { params });
      
      setProducts(res.data.products || []);
      setTotalProducts(res.data.pagination?.totalProducts || 0);
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
        url: getImageUrl(imgName),
        response: { fileName: imgName } // Lưu lại tên file để nhận diện khi submit
      }));
      setFileList(formattedFiles);
    } else {
      setFileList([]);
    }
    setIsModalOpen(true);
  };

 const handleImportExcel = async (file) => {
  if (!file) return;
  
  const formData = new FormData();
  formData.append('excelFile', file);

  setImporting(true);
  try {
    const response = await API.post('/api/products/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob' // 🌟 QUAN TRỌNG: Bảo bảo axios nhận dữ liệu dạng Blob/Binary để xử lý file trả về
    });

    // Nếu Backend xử lý hoàn toàn thành công (Không có dòng dữ liệu nào lỗi)
    // Vì dùng responseType: 'blob' nên response.data lúc này là một chuỗi Blob, cần chuyển sang JSON text để đọc
    const text = await response.data.text();
    const result = JSON.parse(text);

    if (result.success) {
      message.success(result.message);
      setImportedProducts(result.products || []);
      setBulkImagesFileList([]); 
      setIsImageModalOpen(true);  
    } else {
      message.error(result.message || 'Import thất bại');
    }
  } catch (error) {
    console.error('Lỗi import excel:', error);
    
    // 🌟 XỬ LÝ KHI CÓ DÒNG BỊ LỖI (Backend trả về mã lỗi kèm file Excel Buffer)
    if (error.response && (error.response.status === 422 || error.response.data instanceof Blob)) {
      try {
        const blobData = error.response.data; // Đây chính là file Excel lỗi nhị phân từ BE gửi về
        
        // Tạo một đường dẫn URL ảo cho file blob dữ liệu
        const url = window.URL.createObjectURL(new Blob([blobData]));
        const link = document.createElement('a');
        link.href = url;
        
        // Ép trình duyệt đặt tên và tải file lỗi này về máy Admin
        link.setAttribute('download', 'File_Loi_Import_San_Pham.xlsx');
        document.body.appendChild(link);
        link.click();
        
        // Dọn dẹp bộ nhớ
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        message.error('File Excel chứa dữ liệu không hợp lệ! Hệ thống đã tự động tải về file báo lỗi chi tiết, vui lòng mở lên kiểm tra.');
      } catch (err) {
        message.error('Có lỗi xảy ra khi tải file báo cáo lỗi.');
      }
    } else {
      // Các lỗi hệ thống khác (500, lỗi mạng, mạng treo)
      message.error('Có lỗi xảy ra trong quá trình kết nối gửi file.');
    }
  } finally {
    setImporting(false);
    setExcelFile(null);
  }
};

  const handleUploadBulkImages = async () => {
  if (bulkImagesFileList.length === 0) {
    message.warning('Vui lòng chọn hoặc kéo thả ít nhất một file ảnh!');
    return;
  }

  const formData = new FormData();
  bulkImagesFileList.forEach(file => {
    formData.append('bulkImageFiles', file.originFileObj);
  });

  setUploadingImages(true);
  try {
    const response = await API.post('/api/products/match-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (response.data.success) {
      message.success(response.data.message);
      setIsImageModalOpen(false);
      setBulkImagesFileList([]);
      fetchProducts();
    }
  } catch (error) {
    console.error('Lỗi upload kho ảnh:', error);
    message.error(error.response?.data?.message || 'Có lỗi khi đồng bộ kho ảnh');
  } finally {
    setUploadingImages(false);
  }
};

  const onFinish = async (values) => {
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingProductId(id);
    try {
      await API.delete(`/api/products/${id}`);
      message.success('Đã xóa sản phẩm!');
      fetchProducts();
    } catch (error) {
      message.error('Lỗi khi xóa sản phẩm');
    } finally {
      setDeletingProductId(null);
    }
  };
  const handleDragEnd = (result) => {
  if (!result.destination) return; // Nếu kéo ra ngoài vùng hợp lệ thì bỏ qua

  const items = Array.from(fileList);
  // Cắt file từ vị trí cũ và chèn vào vị trí mới
  const [reorderedItem] = items.splice(result.source.index, 1);
  items.splice(result.destination.index, 0, reorderedItem);

  setFileList(items); // Cập nhật lại thứ tự mảng fileList
};

// Hàm hỗ trợ xóa một ảnh cụ thể ra khỏi danh sách khi tự render
const handleRemoveImage = (uid) => {
  const filtered = fileList.filter(item => item.uid !== uid);
  setFileList(filtered);
};

  const columns = [
    { 
      title: 'Tên sản phẩm',
      width: 300,
      render: (_, record) => {
        const mainImage = Array.isArray(record.image) ? record.image[0] : record.image;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src={getImageUrl(mainImage, '/images/default-product.jpg')}  
              style={{ maxHeight: '40px', maxWidth: '40px', objectFit: 'contain' }}  
              alt={record.name}
            />
            <span style={{ fontWeight: 600, color: '#333' }}>{record.name}</span> 
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
            onConfirm={() => handleDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deletingProductId === record._id }}
          >
            <Button danger icon={<DeleteOutlined />}>Xóa</Button>
          </Popconfirm>
        </Space>
      ) 
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Title level={2} style={{ margin: 0 }}>Quản Lý Hệ Thống Sản Phẩm</Title>

        <Space size="middle">
          <Button 
            type="default" 
            icon={<DownloadOutlined />} 
            href="/Template_Import_San_Pham.xlsx"
            download="Template_Import_San_Pham.xlsx"     
          >
            Tải file mẫu Excel
          </Button>

          <Upload
            accept=".xlsx, .xls"
            beforeUpload={(file) => {
              setExcelFile(file);
              handleImportExcel(file);
              return false; 
            }}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              Import Excel sản phẩm
            </Button>
          </Upload>

          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddClick}
          >
            Thêm sản phẩm mới
          </Button>
        </Space>
      </div>
     
      <Card style={{ marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: '12px 16px' }}>
        <Space direction="horizontal" wrap size="small">
          <Input.Search
            placeholder="Tìm tên sản phẩm..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 210 }}
            onSearch={(value) => setFilters(prev => ({ ...prev, search: value, page: 1 }))}
          />

          <Select
            placeholder="Lọc theo danh mục"
            style={{ width: 170 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, category: value, page: 1 }))}
          >
            {categories.map(c => (
              <Select.Option key={c._id} value={c.name}>{c.name}</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Lọc theo thương hiệu"
            style={{ width: 170 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, brand: value, page: 1 }))}
          >
            {brands.map(b => (
              <Select.Option key={b._id} value={b.name}>{b.name}</Select.Option>
            ))}
          </Select>

          <InputNumber
            placeholder="Giá tối thiểu"
            style={{ width: 140 }}
            min={0}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            onChange={(value) => setFilters(prev => ({ ...prev, minPrice: value, page: 1 }))}
          />
          
          <span style={{ color: '#bfbfbf' }}>-</span>

          <InputNumber
            placeholder="Giá tối đa"
            style={{ width: 140 }}
            min={0}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            onChange={(value) => setFilters(prev => ({ ...prev, maxPrice: value, page: 1 }))}
          />
        </Space>
      </Card>

      <Table 
        dataSource={products} 
        columns={columns} 
        rowKey="_id"
        pagination={{
        current: filters.page,
        pageSize: filters.limit,
        total: totalProducts,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        locale: { items_per_page: '/ trang' },
        showTotal: (total) => `Tổng cộng ${total} sản phẩm`,
        onChange: (page, pageSize) => {
          setFilters(prev => ({
            ...prev,
            page: page,
            limit: pageSize
          }));
        }
      }}
      />

      <Modal 
        title={editingProduct ? "Chỉnh sửa thông tin sản phẩm" : "Thêm sản phẩm mới"} 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()}
        confirmLoading={saving}
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
            <InputNumber 
              style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item label="Danh mục" name="category" rules={[{ required: true, message: 'Vui lòng chọn danh mục!' }]}>
            <Select placeholder="Chọn danh mục">
              {categories.map(c => (
                <Select.Option key={c._id} value={c.name}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Hình ảnh sản phẩm (Kéo thả để sắp xếp vị trí hiển thị, ảnh đầu tiên sẽ làm ảnh đại diện)">
            {/* Cấu hình nút bấm chọn file ẩn danh sách mặc định của antd */}
            <Upload
              listType="picture-card"
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              beforeUpload={() => false}
              multiple={true}
              showUploadList={false} // 🌟 BẮT BUỘC: Ẩn danh sách cũ đi để tự render kéo thả
            >
              {fileList.length < 8 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Thêm ảnh mới</div>
                </div>
              )}
            </Upload>

            {/* Khởi chạy không gian Kéo & Thả */}
            {fileList.length > 0 && (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="images-grid" direction="horizontal">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '12px', 
                        marginTop: '16px',
                        background: '#fafafa',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px dashed #d9d9d9'
                      }}
                    >
                      {fileList.map((file, index) => (
                        <Draggable key={file.uid} draggableId={file.uid} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{
                                userSelect: 'none',
                                padding: '8px',
                                width: '104px',
                                height: '104px',
                                background: '#fff',
                                border: snapshot.isDragging ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                borderRadius: '4px',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                                ...provided.draggableProps.style // Giữ nguyên style tính toán vị trí của thư viện
                              }}
                            >
                              {/* Nút nhỏ góc trên bên phải để xóa ảnh nhanh */}
                              <Button
                                size="small"
                                shape="circle"
                                danger
                                icon={<DeleteOutlined style={{ fontSize: '10px' }} />}
                                onClick={() => handleRemoveImage(file.uid)}
                                style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  zIndex: 10,
                                  width: '20px',
                                  height: '20px',
                                  minWidth: '20px',
                                  padding: 0
                                }}
                              />

                              {/* Ảnh hiển thị */}
                              <img
                                src={file.url || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : '')}
                                alt="Xem trước"
                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '2px' }}
                              />

                              {/* Tay cầm dùng để rê chuột và kéo (Đặt đè lên góc ảnh dưới) */}
                              <div
                                {...provided.dragHandleProps}
                                style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  right: '2px',
                                  background: 'rgba(0,0,0,0.4)',
                                  color: '#fff',
                                  padding: '2px 4px',
                                  borderRadius: '2px',
                                  cursor: 'move',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <MenuOutlined style={{ marginRight: '2px' }} />
                                {index === 0 ? 'Chính' : index + 1}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </Form.Item>

          <Form.Item label="Mô tả sản phẩm" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 🌟 MODAL KÉO THẢ ẢNH HÀNG LOẠT THEO MÔ HÌNH 2 */}
      <Modal
        title="Đồng bộ kho ảnh sản phẩm vừa Import"
        open={isImageModalOpen}
        onCancel={() => {
          setIsImageModalOpen(false);
          fetchProducts(); // Vẫn fetch lại sản phẩm ngoài bảng dù tắt modal
        }}
        onOk={handleUploadBulkImages}
        confirmLoading={uploadingImages}
        okText="Bắt đầu đồng bộ ảnh"
        cancelText="Để sau"
        width={750}
        destroyOnClose
      >
        <div style={{ marginBottom: '16px', padding: '12px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontWeight: 500, color: '#0050b3' }}>
            🎉 Đã khởi tạo thành công bản nháp của <strong>{importedProducts.length}</strong> sản phẩm từ file Excel!
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#595959' }}>
            Hệ thống đang chờ bạn nạp các file ảnh cứng có tên khớp với tên bạn đã khai báo trong file Excel để kích hoạt hiển thị sản phẩm.
          </p>
        </div>

        {/* Khu vực Kéo & Thả File ảnh của Ant Design */}
        <div style={{ marginBottom: '20px' }}>
          <Upload.Dragger
            multiple={true}
            listType="picture"
            fileList={bulkImagesFileList}
            accept="image/*"
            beforeUpload={() => false} // Chặn không cho tự động upload đơn lẻ
            onChange={({ fileList: newFileList }) => setBulkImagesFileList(newFileList)}
          >
            <p className="ant-upload-drag-icon" style={{ fontSize: '40px', color: '#1890ff' }}>
              <UploadOutlined />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>
              Kéo thả toàn bộ ảnh sản phẩm vào đây hoặc click để chọn file
            </p>
            <p className="ant-upload-hint">
              Hỗ trợ chọn nhiều file ảnh cùng một lúc (JPG, PNG, WEBP...). Hãy chắc chắn tên file ảnh trùng với tên file trong ô Excel.
            </p>
          </Upload.Dragger>
        </div>

        {/* Danh sách Check-list gợi ý tên file cần nạp để Admin đối chiếu trực quan */}
        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '12px' }}>
          <span style={{ fontWeight: 600, display: 'block', marginBottom: '8px', color: '#262626' }}>
            Danh sách các file ảnh hệ thống đang chờ khớp:
          </span>
          <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#8c8c8c' }}>
            {importedProducts.map((prod, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                <strong style={{ color: '#595959' }}>{prod.name}</strong>: {' '}
                {prod.imageNamesPlaceholder && prod.imageNamesPlaceholder.length > 0 ? (
                  prod.imageNamesPlaceholder.map((imgName, idx) => {
                    // Kiểm tra xem Admin đã chọn file này vào list upload chưa để đổi màu trực quan
                    const isSelected = bulkImagesFileList.some(f => f.name.toLowerCase().trim() === imgName.toLowerCase().trim());
                    return (
                      <span 
                        key={idx} 
                        style={{ 
                          marginRight: '8px', 
                          background: isSelected ? '#f6ffed' : '#fff1f0', 
                          color: isSelected ? '#389e0d' : '#cf1322',
                          border: isSelected ? '1px solid #b7eb8f' : '1px solid #ffa39e',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          fontSize: '12px',
                          display: 'inline-block'
                        }}
                      >
                        {imgName} {isSelected ? '✓' : ''}
                      </span>
                    );
                  })
                ) : (
                  <span style={{ italic: 'true' }}>Không yêu cầu ảnh</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default AdminProducts;