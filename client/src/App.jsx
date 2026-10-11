import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';

import Home from './pages/Home';
import Destinations from './pages/Destinations';
import DestinationDetail from './pages/DestinationDetail';
import Packages from './pages/Packages';
import PackageDetail from './pages/PackageDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

import Login from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Bookings from './pages/admin/Bookings';
import Inquiries from './pages/admin/Inquiries';
import DestinationsAdmin from './pages/admin/Destinations';
import PackagesAdmin from './pages/admin/Packages';
import MediaAdmin from './pages/admin/Media';
import SettingsPage from './pages/admin/Settings';

/** Public routes render the site chrome; the dashboard renders its own. */
function SiteShell() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" style={{ minHeight: '60vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/destinations/:slug" element={<DestinationDetail />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/packages/:slug" element={<PackageDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

function DashboardRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Overview />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="inquiries" element={<Inquiries />} />
        <Route path="destinations" element={<DestinationsAdmin />} />
        <Route path="packages" element={<PackagesAdmin />} />
        <Route path="media" element={<MediaAdmin />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Overview />} />
      </Route>
    </Routes>
  );
}

/**
 * One place decides which shell a path gets, so /admin/* never flashes the
 * public header and every other URL keeps the marketing chrome.
 */
export default function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  // Reset scroll position between routes; detail pages can be long.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);

  return (
    <div className={`app${isAdmin ? ' app--admin' : ''}`}>
      {isAdmin ? <DashboardRoutes /> : <SiteShell />}
    </div>
  );
}
