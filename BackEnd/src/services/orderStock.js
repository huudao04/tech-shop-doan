import Product from '../models/Product.js';

export const reserveOrderStock = async (order) => {
  if (!order || order.stockReserved) return false;

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
  }

  order.stockReserved = true;
  return true;
};

export const releaseOrderStock = async (order) => {
  if (!order || !order.stockReserved) return false;

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
  }

  order.stockReserved = false;
  return true;
};

export const markOrderAsPaid = async (order) => {
  if (!order || order.paymentStatus === 'Đã thanh toán') return false;

  await reserveOrderStock(order);

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { sold: item.quantity } });
  }

  order.paymentStatus = 'Đã thanh toán';
  await order.save();
  return true;
};
