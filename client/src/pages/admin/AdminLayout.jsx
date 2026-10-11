import { Navigate, NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/admin', label: 'Overview', end: true, icon: '◈' },
  { to: '/admin/bookings', label: 'Bookings', icon: '✈' },
  { to: '/admin/inquiries', label: 'Inquiries', icon: '✉' },
  { to: '/admin/destinations', label: 'Destinations', icon: '◎' },
  { to: '/admin/packages', label: 'Packages', icon: '❏' },
  { to: '/admin/media', label: 'Media', icon: '▣' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙' },
];

/**
 * Auth guard + shell for every dashboard route. Unauthenticated visitors
 * are redirected to the login screen, preserving where they were headed.
 */
export default function AdminLayout() {
  const { user, booting, isAuthenticated, logout } = useAuth();

  if (booting) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }} aria-busy="true">
        <span className="spin" style={{ fontSize: '1.6rem', color: 'var(--teal-700)' }} aria-label="Loading">
          ⟳
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: window.location.pathname }} />;
  }

  return (
    <div className="page-enter" style={{ background: '#f6f7f8', minHeight: '100vh' }}>
      <div
        style={{
          position: 'sticky',
          top: 'var(--header-h)',
          zIndex: 40,
          background: 'var(--white)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            paddingTop: '0.7rem',
            paddingBottom: '0.7rem',
          }}
        >
          <nav
            aria-label="Dashboard"
            style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
                style={{ fontSize: '0.9rem' }}
              >
                <span aria-hidden="true" style={{ marginRight: 6, opacity: 0.6 }}>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="row" style={{ gap: '0.6rem' }}>
            <Link to="/" className="btn btn--outline btn--sm">
              View site
            </Link>
            <span className="muted" style={{ fontSize: '0.86rem' }}>
              {user?.name}
            </span>
            <button type="button" className="btn btn--sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <main className="container" style={{ paddingBlock: 'clamp(24px, 3vw, 38px)' }}>
        <Outlet />
      </main>
    </div>
  );
}
