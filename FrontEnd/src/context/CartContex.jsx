import React, { createContext, useState, useContext, useEffect } from 'react';
import API from '../utils/axiosClient';

const CartContext = createContext();

const normalizeCartItem = (item = {}) => ({
  id: item.id || item._id || item.productId || '',
  _id: item._id || item.id || item.productId || '',
  productId: item.productId || item.id || item._id || '',
  name: item.name || '',
  price: Number(item.price) || 0,
  image: Array.isArray(item.image) ? (item.image[0] || '') : (item.image || ''),
  brand: item.brand || '',
  category: item.category || '',
  quantity: Math.max(1, Number(item.quantity) || 1)
});

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(true);

  const syncCartItems = (items = []) => {
    const normalizedItems = items.map(normalizeCartItem).filter(item => item.id);
    setCartItems(normalizedItems);
    return normalizedItems;
  };

  const fetchCart = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setCartItems([]);
      setCartLoading(false);
      return [];
    }

    setCartLoading(true);

    try {
      const response = await API.get('/api/cart');
      return syncCartItems(response.data?.items || []);
    } catch (error) {
      console.error('Không thể tải giỏ hàng từ API', error);
      setCartItems([]);
      return [];
    } finally {
      setCartLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();

    const handleAuthChange = () => {
      fetchCart();
    };

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const updateCart = async (newCart) => {
    const normalizedCart = syncCartItems(newCart);
    const token = localStorage.getItem('token');

    if (!token) {
      return normalizedCart;
    }

    try {
      const response = await API.put('/api/cart', { items: normalizedCart });
      if (Array.isArray(response.data?.items)) {
        return syncCartItems(response.data.items);
      }
      return normalizedCart;
    } catch (error) {
      console.error('Không thể đồng bộ giỏ hàng', error);
      return normalizedCart;
    }
  };

  const clearCart = async () => updateCart([]);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, updateCart, clearCart, totalCount, totalPrice, cartLoading, refreshCart: fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);