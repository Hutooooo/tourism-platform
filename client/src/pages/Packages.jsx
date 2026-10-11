import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import PackageCard from '../components/PackageCard';

const DIRECTIONS = [
  { value: '', label: 'All tours' },
  { value: 'SL_TO_IT', label: 'Sri Lanka → Italy' },
  { value: 'IT_TO_SL', label: 'Italy → Sri Lanka' },
  { value: 'BOTH', label: 'Both directions' },
];

export default function Packages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const direction = searchParams.get('direction') || '';
  const destinationSlug = searchParams.get('destination') || '';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useSeo({
    title: 'Tour packages',
    description: 'Tour packages between Sri Lanka and Italy, in both directions.',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (direction) params.set('direction', direction);
        if (debounced) params.set('q', debounced);

        // Resolve a destination slug (linked from a destination page) to the
        // numeric id the API expects.
        if (destinationSlug) {
          try {
            const dest = await api.get(`/destinations/${destinationSlug}`);
            if (dest && dest.id) params.set('destination_id', dest.id);
          } catch {
            // Unknown destination → just list everything rather than erroring.
          }
        }

        const data = await api.get(`/packages?${params.toString()}`);
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [direction, destinationSlug, debounced]);

  const setDirection = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('direction', value);
    else next.delete('direction');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          <Reveal>
            <div className="eyebrow">Tour packages</div>
            <h1>Journeys in both directions</h1>
            <p className="lead" style={{ marginTop: '0.9rem' }}>
              Each one is a starting point. Dates, pace, hotels and stops can all be adjusted around
              what you want.
            </p>
          </Reveal>

          <Reveal delay={90} style={{ marginTop: '1.6rem' }}>
            <div className="row" role="group" aria-label="Filter by direction">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.value || 'all'}
                  type="button"
                  className={`btn btn--sm ${direction === d.value ? '' : 'btn--outline'}`}
                  aria-pressed={direction === d.value}
                  onClick={() => setDirection(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="row" style={{ marginTop: '0.9rem' }}>
              <label className="sr-only" htmlFor="pkg-search">
                Search tours
              </label>
              <input
                id="pkg-search"
                className="input"
                type="search"
                placeholder="Search tours…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ maxWidth: 300 }}
              />
              {destinationSlug && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete('destination');
                    setSearchParams(next, { replace: true });
                  }}
                >
                  Clear destination filter ✕
                </button>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {loading && (
            <div className="grid grid--3" aria-busy="true" aria-live="polite">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card">
                  <div className="skeleton" style={{ aspectRatio: '16/10', borderRadius: 0 }} />
                  <div className="card__body">
                    <div className="skeleton" style={{ height: 22, width: '72%', marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: '50%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && <div className="alert alert--error">{error}</div>}

          {!loading && !error && items.length === 0 && (
            <div className="center" style={{ padding: '3rem 1rem' }}>
              <h3>No tours match those filters</h3>
              <p className="muted" style={{ marginTop: '0.6rem' }}>
                Try another direction, or tell us what you have in mind and we will build one.
              </p>
              <button
                type="button"
                className="btn btn--outline"
                style={{ marginTop: '1.2rem' }}
                onClick={() => {
                  setQuery('');
                  setDirection('');
                }}
              >
                Reset filters
              </button>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid--3">
              {items.map((p, i) => (
                <Reveal key={p.id || p.slug} delay={(i % 3) * 70}>
                  <PackageCard pkg={p} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
