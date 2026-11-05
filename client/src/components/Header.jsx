import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useScrolledPast } from '../hooks/useReveal';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const { settings } = useSettings();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const stuck = useScrolledPast(10);
  const getLinks = () => [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/destinations', label: t('nav.destinations') },
    { to: '/packages', label: t('nav.tours') },
    { to: '/about', label: t('nav.about') },
    { to: '/contact', label: t('nav.contact') },
  ];

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
        <Link to="/" className="brand" aria-label={t('header.brandAria', { brand: settings.brand_name })}>
          <span className="brand__mark" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M4 17c3.5-8 8-11 12-11 3 0 5 1.6 7 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="6" cy="18" r="2.4" fill="currentColor" />
              <circle cx="18.5" cy="7.5" r="2.4" fill="currentColor" />
            </svg>
          </span>
          <span className="brand__text">{settings.brand_name}</span>
        </Link>

        <nav className={`nav${open ? ' is-open' : ''}`} id="primary-nav" aria-label={t('header.navAria')}>
          {getLinks().map((link) => (
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
              {t('nav.planTrip')}
            </a>
          ) : (
            <Link className="btn btn--brass btn--sm" to="/contact" onClick={() => setOpen(false)}>
              {t('nav.planTrip')}
            </Link>
          )}
        </nav>

        <div className="header__actions">
          {/* Admin access is restricted via authentication middleware on the server. */}
          <div className="language-selector" style={{ display: 'flex', alignItems: 'center', marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginRight: '0.5rem' }}>
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <select
              value={i18n.language}
              onChange={(e) => {
                const lang = e.target.value;
                i18n.changeLanguage(lang);
                localStorage.setItem('lang', lang);
                // Update URL prefix while preserving the rest of the path
                const newPath = '/' + lang + window.location.pathname.replace(/^\/(en|si|it)?/, '');
                window.history.replaceState(null, '', newPath + window.location.search + window.location.hash);
                document.documentElement.lang = lang;
              }}
            >
              <option value="en">English</option>
              <option value="si">සිංහල</option>
              <option value="it">Italiano</option>
            </select>
          </div>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            aria-label={open ? t('header.toggleAriaClose') : t('header.toggleAriaOpen')}
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
