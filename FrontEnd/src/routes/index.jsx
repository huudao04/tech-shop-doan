import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';
import UserLayout from '../layouts/UserLayout';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import AdminProducts from '../pages/AdminProducts';
import AdminOrders from '../pages/AdminOrders';
import AdminReports from '../pages/AdminReports';
import AdminReviews from '../pages/AdminReviews';
import AdminUsers from '../pages/AdminUsers';
import AdminVouchers from '../pages/AdminVouchers';
import Home from '../pages/Home';
import ProductDetail from '../pages/ProductDetail';
import Cart from '../pages/Cart';
import Checkout from '../layouts/CheckOut';
import Products from '../pages/Products';
import Login from '../pages/Login';
import ProtectedRoute from '../components/ProtectedRoute';
import Profile from '../pages/Profile';
import UserOrders from '../pages/UserOrders';
import ResetPassword from '../pages/ResetPassword.jsx';
import PolicyWarranty from '../pages/inforStatic/PolicyWarranty.jsx';
import PolicyReturn from '../pages/inforStatic/PolicyReturn.jsx';
import PolicyShipping from '../pages/inforStatic/PolicyShipping.jsx';
import PolicyPrivacy from '../pages/inforStatic/PolicyPrivacy.jsx';
import ServiceRepair from '../pages/inforStatic/ServiceRepair.jsx';
import ServiceInstallment from '../pages/inforStatic/ServiceInstallment.jsx';
import TechNews from '../pages/inforStatic/TechNews.jsx';
import BusinessContact from '../pages/inforStatic/BusinessContact.jsx';
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: <Login />
      },
      {
        path: '/reset-password',
        element: <ResetPassword />
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
          { path: 'my-orders', element: <UserOrders /> },
          { path: 'policy/warranty', element: <PolicyWarranty /> },
          { path: 'policy/return', element: <PolicyReturn /> },
          { path: 'policy/shipping', element: <PolicyShipping /> },
          { path: 'policy/privacy', element: <PolicyPrivacy /> },
          { path: 'services/repair', element: <ServiceRepair /> },
          { path: 'services/installment', element: <ServiceInstallment /> },
          { path: 'news', element: <TechNews /> },
          { path: 'contact', element: <BusinessContact /> }
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
          { path: 'reviews', element: <AdminReviews /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'vouchers', element: <AdminVouchers /> }
        ],
      }
    ],
  }
]);