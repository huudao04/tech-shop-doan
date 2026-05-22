import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Typography, Slider, Checkbox, Space, Empty, Spin, message } from 'antd';
import { ShoppingCartOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import API from '../utils/axiosClient';
import { useCart } from '../context/CartContex.jsx';

const { Title, Text } = Typography;

const Products = () => {
  const { cartItems, updateCart } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // States danh sách hiển thị cố định ở ô Checkbox lấy từ API riêng biệt
  const [brandsList, setBrandsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  // States lưu mảng các giá trị được tích chọn (Hỗ trợ chọn nhiều cùng lúc)
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  
  // States khoảng giá
  const [priceRange, setPriceRange] = useState([0, 50000000]);
  const [debouncedPriceRange, setDebouncedPriceRange] = useState([0, 50000000]);

  // Bên trong component Products:
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const searchParam = queryParams.get('search') || '';
  
    useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // Truyền tham số search lấy từ URL vào API backend
        const response = await API.get(`/api/products?search=${encodeURIComponent(searchParam)}`);
        setProducts(response.data);
      } catch (error) {
        message.error("Không thể tải danh sách sản phẩm");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [searchParam]);
  // ==========================================
  // 1. GỌI API RIÊNG BIỆT ĐỂ LẤY CỐ ĐỊNH DANH SÁCH BRAND & CATEGORY (CHẠY 1 LẦN)
  // ==========================================
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        // Gọi đồng thời cả 2 API để tối ưu tốc độ load trang
        const [brandRes, catRes] = await Promise.all([
          API.get('/api/brands'),
          API.get('/api/categories')
        ]);
        
        // Vì backend trả về mảng object chứa { name, slug } nên ta map lấy trường name
        setBrandsList(brandRes.data.map(b => b.name));
        setCategoriesList(catRes.data.map(c => c.name));
      } catch (error) {
        console.error("Lỗi khởi tạo dữ liệu bộ lọc:", error);
      }
    };
    fetchFilterData();
  }, []); // [] Đảm bảo danh sách checkbox đứng im, không bị thay đổi khi bấm lọc

  // 2. Debounce khoảng giá (Đợi ngưng kéo slider 400ms mới kích hoạt gọi API)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPriceRange(priceRange);
    }, 400);
    return () => clearTimeout(handler);
  }, [priceRange]);

  // ==========================================
  // 3. GỌI API /api/products KÈM PARAMS ĐỂ LỌC SẢN PHẨM KHHI STATE THAY ĐỔI
  // ==========================================
  useEffect(() => {
    const fetchFilteredProducts = async () => {
      setLoading(true);
      try {
        const params = {};

        // Nếu backend xử lý dạng chuỗi, map mảng thành chuỗi phân tách bằng dấu phẩy
        // Hoặc truyền trực tiếp nếu backend của bạn nhận mảng hoặc chuỗi đơn
        if (selectedBrands.length > 0) {
          params.brand = selectedBrands.join(',');
        }
        if (selectedCategories.length > 0) {
          params.category = selectedCategories.join(',');
        }

        // Thêm khoảng giá Min - Max đúng tên params backend cần nhận
        if (debouncedPriceRange[0] > 0) params.minPrice = debouncedPriceRange[0];
        if (debouncedPriceRange[1] < 50000000) params.maxPrice = debouncedPriceRange[1];

        // Gửi request lên API kèm theo query params lọc sản phẩm
        const response = await API.get('/api/products', { params });
        setProducts(response.data);
      } catch (error) {
        console.error("Lỗi gọi API lọc sản phẩm:", error);
        message.error("Lỗi kết nối bộ lọc từ hệ thống!");
      } finally {
        setLoading(false);
      }
    };

    fetchFilteredProducts();
  }, [selectedBrands, selectedCategories, debouncedPriceRange]);

  // 4. Hàm xử lý thêm vào giỏ hàng nhanh
  const handleAddToCart = (product) => {
    const existingItem = cartItems.find(item => item.id === product._id);
    let newCart;

    if (existingItem) {
      newCart = cartItems.map(item =>
        item.id === product._id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...cartItems, {
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        brand: product.brand,
        category: product.category,
        quantity: 1
      }];
    }
    updateCart(newCart);
    message.success(`🛒 Đã thêm "${product.name}" vào giỏ hàng!`);
  };

  // Hàm xóa nhanh toàn bộ trạng thái lọc
  const handleResetFilters = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setPriceRange([0, 50000000]);
  };

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '10px 0' }}>
      <Row gutter={[24, 24]}>
        
        {/* THANH BỘ LỌC BÊN TRÁI */}
        <Col xs={24} md={6}>
          <Card 
            title={<Space><FilterOutlined /> Bộ lọc sản phẩm</Space>} 
            style={{ borderRadius: 8 }}
            extra={<Button type="link" size="small" onClick={handleResetFilters} style={{ padding: 0 }}>Xóa hết</Button>}
          >
            {/* Lọc theo Danh mục */}
            <div style={{ marginBottom: 25 }}>
              <Text strong style={{ display: 'block', marginBottom: 10 }}>Danh mục sản phẩm</Text>
              <Checkbox.Group
                style={{ width: '100%' }}
                value={selectedCategories}
                onChange={(checkedValues) => setSelectedCategories(checkedValues)}
              >
                <Row gutter={[0, 8]}>
                  {categoriesList.map(cat => (
                    <Col span={24} key={cat}>
                      <Checkbox value={cat}>{cat}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </div>

            {/* Lọc theo Thương hiệu */}
            <div style={{ marginBottom: 25 }}>
              <Text strong style={{ display: 'block', marginBottom: 10 }}>Thương hiệu</Text>
              <Checkbox.Group
                style={{ width: '100%' }}
                value={selectedBrands}
                onChange={(checkedValues) => setSelectedBrands(checkedValues)}
              >
                <Row gutter={[0, 8]}>
                  {brandsList.map(brand => (
                    <Col span={24} key={brand}>
                      <Checkbox value={brand}>{brand}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </div>

            {/* Lọc theo khoảng giá */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 10 }}>Khoảng giá (VNĐ)</Text>
              <Slider 
                range 
                min={0} 
                max={50000000} 
                step={500000} 
                value={priceRange} 
                onChange={(value) => setPriceRange(value)} 
                tooltip={{ formatter: (val) => `${val.toLocaleString()}đ` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{priceRange[0].toLocaleString()}đ</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{priceRange[1].toLocaleString()}đ</Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* LƯỚI HIỂN THỊ DANH SÁCH SẢN PHẨM BÊN PHẢI */}
        <Col xs={24} md={18}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <Spin size="large" tip="Đang cập nhật danh sách..." />
            </div>
          ) : products.length === 0 ? (
            <Empty description="Không tìm thấy sản phẩm nào phù hợp!" style={{ padding: '60px 0' }} />
          ) : (
            <Row gutter={[16, 16]}>
              {products.map((product) => (
                <Col xs={12} sm={12} md={8} lg={6} key={product._id}>
                  <Card
                    hoverable
                    style={{ borderRadius: 8, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    bodyStyle={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    cover={
                      <Link to={`/product/${product._id}`}>
                        <img
                          alt={product.name}
                          src={product.image && product.image[0] 
                            ? (product.image[0].startsWith('http') ? product.image[0] : `/images/${product.image[0]}`)
                            : '/images/default-product.jpg'}
                          style={{ height: 180, width: '100%', objectFit: 'contain', padding: 8, background: '#f9f9f9' }}
                        />
                      </Link>
                    }
                  >
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        {product.brand && <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginRight: 8 }}>{product.brand}</span>}
                        {product.category && <span style={{ fontSize: 11, color: '#1677ff', background: '#e6f4ff', padding: '2px 6px', borderRadius: 4 }}>{product.category}</span>}
                      </div>
                      
                      <Title level={5} style={{ margin: '4px 0 8px 0', fontSize: 14, height: 40, overflow: 'hidden', display: '-webkit-box', overflowWrap: 'anywhere', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {product.name}
                      </Title>
                      
                      <div style={{ marginBottom: 12 }}>
                        <Text type="danger" strong style={{ fontSize: 16 }}>
                          {product.price.toLocaleString()} VNĐ
                        </Text>
                        {product.stock <= 0 && (
                          <span style={{ marginLeft: 8, color: '#f5222d', fontSize: 12, background: '#fff1f0', padding: '2px 6px', borderRadius: 4 }}>Hết hàng</span>
                        )}
                      </div>
                    </div>

                    <Space size="middle" style={{ width: '100%', justifyContent: 'space-between', marginTop: 'auto' }}>
                      <Link to={`/product/${product._id}`}>
                        <Button icon={<EyeOutlined />}>Chi tiết</Button>
                      </Link>
                      <Button 
                        type="primary" 
                        icon={<ShoppingCartOutlined />} 
                        disabled={product.stock <= 0}
                        onClick={() => handleAddToCart(product)}
                      >
                        Thêm giỏ
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Col>

      </Row>
    </div>
  );
};

export default Products;