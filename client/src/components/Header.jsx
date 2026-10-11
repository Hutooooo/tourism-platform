import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useScrolledPast } from '../hooks/useReveal';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/destinations', label: 'Destinations' },
  { to: '/packages', label: 'Tours' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const { settings } = useSettings();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const stuck = useScrolledPast(10);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`header${stuck ? ' is-stuck' : ''}`}>
      <div className="container header__inner">
        <Link to="/" className="brand" aria-label={`${settings.brand_name} — home`}>
          <span className="brand__mark" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 17c3.5-8 8-11 12-11 3 0 5 1.6 7 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="6" cy="18" r="2.4" fill="currentColor" />
              <circle cx="18.5" cy="7.5" r="2.4" fill="currentColor" />
            </svg>
          </span>
          <span className="brand__text">{settings.brand_name}</span>
        </Link>

        <nav className={`nav${open ? ' is-open' : ''}`} id="primary-nav" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          {location.pathname === '/' ? (
            // The home page has the #enquire anchor; elsewhere it would be a dead link.
            <a className="btn btn--brass btn--sm" href="#enquire" onClick={() => setOpen(false)}>
              Plan your trip
            </a>
          ) : (
            <Link className="btn btn--brass btn--sm" to="/contact" onClick={() => setOpen(false)}>
              Plan your trip
            </Link>
          )}
        </nav>

        <div className="header__actions">
          {isAuthenticated ? (
            <Link to="/admin" className="btn btn--outline btn--sm">
              Dashboard
            </Link>
          ) : (
            <Link to="/admin/login" className="btn btn--outline btn--sm">
              Admin
            </Link>
          )}
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
