import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

/**
 * Holds the bootstrap payload (settings, contact links, catalogue) so the
 * header, footer and contact page all read from one source of truth.
 */
const SettingsContext = createContext(null);

const FALLBACK = {
  brand_name: 'Sri Lanka ↔ Italy Tourism',
  tagline: '',
  contact_email: 'nuwanmalinda1978@gmail.com',
  contact_phone: '+39 389 102 2909',
  contact_whatsapp: '+39 389 102 2909',
  directions: ['SL_TO_IT', 'IT_TO_SL'],
  hero_title: '',
  hero_subtitle: '',
  about_title: '',
  about_body: '',
  seo: { title_suffix: 'Sri Lanka ↔ Italy Tourism', description: '', keywords: [] },
  currency: 'EUR',
  booking_enabled: true,
  inquiry_enabled: true,
  footer_note: '',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);
  const [contact, setContact] = useState(() => deriveContact(FALLBACK));
  const [destinations, setDestinations] = useState([]);
  const [destinationsByCountry, setDestinationsByCountry] = useState({ 'Sri Lanka': [], Italy: [] });
  const [packages, setPackages] = useState([]);
  const [stats, setStats] = useState({ destinations: 0, packages: 0, countries: 2 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/public/bootstrap');
        if (cancelled) return;
        setSettings({ ...FALLBACK, ...data.settings });
        setContact(data.contact);
        setDestinations(data.destinations || []);
        setDestinationsByCountry(data.destinationsByCountry || { 'Sri Lanka': [], Italy: [] });
        setPackages(data.packages || []);
        setStats(data.stats || { destinations: 0, packages: 0, countries: 2 });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      settings,
      contact,
      destinations,
      destinationsByCountry,
      packages,
      stats,
      loading,
      error,
      /** Re-fetch after an admin saves content, so the public site updates. */
      refresh: async () => {
        try {
          const data = await api.get('/public/bootstrap');
          setSettings({ ...FALLBACK, ...data.settings });
          setContact(data.contact);
          setDestinations(data.destinations || []);
          setDestinationsByCountry(data.destinationsByCountry || { 'Sri Lanka': [], Italy: [] });
          setPackages(data.packages || []);
          setStats(data.stats || { destinations: 0, packages: 0, countries: 2 });
        } catch (err) {
          setError(err.message);
        }
      },
    }),
    [settings, contact, destinations, destinationsByCountry, packages, stats, loading, error]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function deriveContact(s) {
  const digits = (v) => String(v || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const wa = digits(s.contact_whatsapp || s.contact_phone);
  return {
    email: { display: s.contact_email, href: s.contact_email ? `mailto:${s.contact_email}` : '' },
    phone: { display: s.contact_phone, href: s.contact_phone ? `tel:${digits(s.contact_phone)}` : '' },
    whatsapp: { display: s.contact_whatsapp || s.contact_phone, href: wa ? `https://wa.me/${wa.replace(/^\+/, '')}` : '' },
  };
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
