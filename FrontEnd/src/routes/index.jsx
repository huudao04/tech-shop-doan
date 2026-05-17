import { createBrowserRouter } from 'react-router-dom';
import UserLayout from '../layouts/UserLayout';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import AdminProducts from '../pages/AdminProducts';
import AdminOrders from '../pages/AdminOrders';
import AdminReports from '../pages/AdminReports';
import AdminReviews from '../pages/AdminReviews';
import Home from '../pages/Home';
import ProductDetail from '../pages/ProductDetail';
import Cart from '../pages/Cart';
import Checkout from '../layouts/CheckOut';
import Products from '../pages/Products';
export const router = createBrowserRouter([
  {
    path: '/',
    element: <UserLayout />,
    children: [
      { 
        index: true, 
        element: <Home /> 
      },
      {
        path: 'products',
        element: <Products />
      },
      { 
        path: 'product/:_id', 
        element: <ProductDetail />
      },
      { 
        path: 'cart', 
        element: <Cart /> 
      },
      {
        path: 'cart/checkout',
        element: <Checkout />
      }
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { 
        index: true,
        element: <AdminDashboard /> 
      },
      { 
        path: '/admin/products', 
        element: <AdminProducts /> 
      },
      { 
        path: '/admin/orders', 
        element: <AdminOrders /> 
      },
      { 
        path: '/admin/reports', 
        element: <AdminReports /> 
      },
      { 
        path: '/admin/reviews', 
        element: <AdminReviews /> 
      }
    ],
  },
]);