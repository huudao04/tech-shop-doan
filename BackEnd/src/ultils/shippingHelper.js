import axios from 'axios';
// Nhớ BẮT BUỘC phải có dấu ngoặc nhọn { } khi import
import { shippingConfig } from '../config/shipping.js'; 

export const calculateDistanceByGraphhopper = async (destLat, destLng) => {
  try {
    // Thêm fallback an toàn: Nếu shippingConfig bị undefined do lỗi import, 
    // hệ thống sẽ tự động dùng tọa độ cứng của Shop mà không báo lỗi 500 nữa.
    const lat = shippingConfig?.SHOP_LAT || 21.583864168473326;
    const lng = shippingConfig?.SHOP_LNG || 105.80729743102243;

    // Gọi API OSRM
    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${destLng},${destLat}?overview=false`;
    
    const response = await axios.get(url);

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const distanceInMeters = response.data.routes[0].distance;
      return distanceInMeters / 1000; // Đổi sang Km
    }

    throw new Error('Không tìm thấy tuyến đường hợp lệ từ địa chỉ này.');
  } catch (error) {
    console.error('Lỗi khi tính toán khoảng cách bằng OSRM:', error.message);
    throw new Error('Lỗi hệ thống tính khoảng cách: ' + error.message);
  }
};