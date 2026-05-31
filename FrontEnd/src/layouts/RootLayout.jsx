import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

const RootLayout = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.key, location.hash]);

  return <Outlet />;
};

export default RootLayout;