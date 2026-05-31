import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ConfigProvider } from 'antd';
import { CartProvider } from './context/CartContex.jsx';
import './styles/theme.css';

function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#047857' } }}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </ConfigProvider>
  );
}

export default App;