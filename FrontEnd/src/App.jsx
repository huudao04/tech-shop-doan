import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ConfigProvider } from 'antd';
import { CartProvider } from './context/CartContex.jsx'; 

function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </ConfigProvider>
  );
}

export default App;