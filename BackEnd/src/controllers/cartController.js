import Cart from '../models/Cart.js';

const normalizeCartItem = (item = {}) => ({
  productId: item.productId || item.id || item._id,
  name: item.name || '',
  price: Number(item.price) || 0,
  image: Array.isArray(item.image) ? (item.image[0] || '') : (item.image || ''),
  brand: item.brand || '',
  category: item.category || '',
  quantity: Math.max(1, Number(item.quantity) || 1)
});

const serializeCartItems = (items = []) => items.map((item) => ({
  id: item.productId?.toString?.() || String(item.productId || ''),
  _id: item.productId?.toString?.() || String(item.productId || ''),
  productId: item.productId?.toString?.() || String(item.productId || ''),
  name: item.name,
  price: item.price,
  image: item.image || '',
  brand: item.brand || '',
  category: item.category || '',
  quantity: item.quantity || 1
}));

export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    return res.json({ success: true, items: serializeCartItems(cart?.items || []) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể tải giỏ hàng' });
  }
};

export const updateCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: 'Dữ liệu giỏ hàng không hợp lệ' });

    const normalizedItems = items.map(normalizeCartItem).filter(i => i.productId && i.name);

    if (normalizedItems.length === 0) {
      await Cart.findOneAndDelete({ userId: req.user.id });
      return res.json({ success: true, items: [] });
    }

    const savedCart = await Cart.findOneAndUpdate({ userId: req.user.id }, { userId: req.user.id, items: normalizedItems }, { new: true, upsert: true, setDefaultsOnInsert: true });
    return res.json({ success: true, items: serializeCartItems(savedCart.items) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể cập nhật giỏ hàng' });
  }
};

export const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.user.id });
    return res.json({ success: true, items: [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể xóa giỏ hàng' });
  }
};
