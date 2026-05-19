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
import Login from '../pages/Login';
import ProtectedRoute from '../components/ProtectedRoute';
import Profile from '../pages/Profile';
import UserOrders from '../pages/UserOrders';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: <UserLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <Products /> },
      { path: 'product/:_id', element: <ProductDetail /> },
      { path: 'cart', element: <Cart /> },
      { path: 'cart/checkout', element: <Checkout /> },
      { path: 'profile', element: <Profile /> },
      { path: 'my-orders', element: <UserOrders /> }
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'products', element: <AdminProducts /> },
      { path: 'orders', element: <AdminOrders /> },
      { path: 'reports', element: <AdminReports /> },
      { path: 'reviews', element: <AdminReviews /> }
    ],
  },
]);