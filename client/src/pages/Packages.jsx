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

const DURATIONS = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Up to 7 days' },
  { value: 'medium', label: '8–10 days' },
  { value: 'long', label: '11+ days' },
];

// Budget buckets compare price-from numbers (no currency conversion) —
// a quick marketing filter, not an FX-aware query.
const BUDGETS = [
  { value: '', label: 'Any budget' },
  { value: 'value', label: 'Under 1,000' },
  { value: 'standard', label: '1,000–1,800' },
  { value: 'premium', label: 'Over 1,800' },
];

function FilterRow({ label, options, value, onChange }) {
  return (
    <div className="row" style={{ marginTop: '0.7rem', gap: '0.45rem', flexWrap: 'wrap' }} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value || 'any'}
          type="button"
          className={`btn btn--sm ${value === o.value ? '' : 'btn--outline'}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Packages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const direction = searchParams.get('direction') || '';
  const destinationSlug = searchParams.get('destination') || '';
  const duration = searchParams.get('duration') || '';
  const budget = searchParams.get('budget') || '';

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
        if (duration) params.set('duration', duration);
        if (budget) params.set('budget', budget);
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
  }, [direction, destinationSlug, duration, budget, debounced]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const hasFilters = Boolean(direction || destinationSlug || duration || budget || debounced);

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
            <FilterRow label="Filter by direction" options={DIRECTIONS} value={direction} onChange={(v) => setParam('direction', v)} />
            <FilterRow label="Filter by duration" options={DURATIONS} value={duration} onChange={(v) => setParam('duration', v)} />
            <FilterRow label="Filter by budget" options={BUDGETS} value={budget} onChange={(v) => setParam('budget', v)} />

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
                  onClick={() => setParam('destination', '')}
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
                  setSearchParams({}, { replace: true });
                }}
              >
                Reset filters
              </button>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              {hasFilters && (
                <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }} aria-live="polite">
                  {items.length} {items.length === 1 ? 'tour' : 'tours'} found
                </p>
              )}
              <div className="grid grid--3">
                {items.map((p, i) => (
                  <Reveal key={p.id || p.slug} delay={(i % 3) * 70}>
                    <PackageCard pkg={p} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
