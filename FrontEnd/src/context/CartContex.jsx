import React, { createContext, useState, useContext, useEffect } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Khởi tạo: Lấy dữ liệu từ LocalStorage khi web vừa load
  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('cart')) || [];
    setCartItems(savedCart);
  }, []);

  // Hàm dùng chung để cập nhật giỏ hàng cho toàn bộ ứng dụng
  const updateCart = (newCart) => {
    setCartItems(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  // Tính tổng số lượng để hiện lên Badge (trên Header)
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Tính tổng tiền (để dùng cho trang Cart)
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, updateCart, totalCount, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);