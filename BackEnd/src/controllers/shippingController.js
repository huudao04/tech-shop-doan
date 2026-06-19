import { calculateDistanceByGraphhopper } from '../ultils/shippingHelper.js';
import { shippingConfig } from '../config/shipping.js'; 

export const calculateShippingFee = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin tọa độ (lat, lng) để tính phí vận chuyển" 
      });
    }

    const distanceKm = await calculateDistanceByGraphhopper(lat, lng);

    // --- LOGIC TÍNH TIỀN SHIP THỰC TẾ (GIỐNG GHTK / SHOPEE) ---
    let shippingFee = 0;
    
    if (distanceKm <= 10) {
        // Dưới 10km (Nội thành/Rất gần): Đồng giá 15.000đ
        shippingFee = 15000;
    } else if (distanceKm <= 50) {
        // Từ 10km - 50km (Ngoại thành/Tỉnh lân cận): 25.000đ
        shippingFee = 25000;
    } else if (distanceKm <= 300) {
        // Từ 50km - 300km (Liên tỉnh): 35.000đ
        shippingFee = 35000;
    } else {
        // Trên 300km (Cách xa như Bắc - Nam): Tối đa 45.000đ
        shippingFee = 45000;
    }

    res.json({
      success: true,
      shippingFee: shippingFee,   
      distanceText: `${distanceKm.toFixed(1)} km`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};