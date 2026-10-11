import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import DestinationCard from '../components/DestinationCard';

const COUNTRY_OPTIONS = ['All', 'Sri Lanka', 'Italy'];

export default function Destinations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const countryParam = searchParams.get('country');
  const activeCountry = COUNTRY_OPTIONS.includes(countryParam) ? countryParam : 'All';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useSeo({
    title: 'Destinations',
    description: 'Destinations in Sri Lanka and Italy that we arrange travel to.',
  });

  // Debounce the search box so we do not fire a request per keystroke.
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
        if (activeCountry !== 'All') params.set('country', activeCountry);
        if (debounced) params.set('q', debounced);
        const data = await api.get(`/destinations?${params.toString()}`);
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
  }, [activeCountry, debounced]);

  const setCountry = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'All') next.delete('country');
    else next.set('country', value);
    setSearchParams(next, { replace: true });
  };

  const grouped = useMemo(() => ({
    'Sri Lanka': items.filter((i) => i.country === 'Sri Lanka'),
    Italy: items.filter((i) => i.country === 'Italy'),
  }), [items]);

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          <Reveal>
            <div className="eyebrow">Destinations</div>
            <h1>Where we take you</h1>
            <p className="lead" style={{ marginTop: '0.9rem' }}>
              Places in both countries we build itineraries around, from the Cultural Triangle to
              the Amalfi Coast.
            </p>
          </Reveal>

          <Reveal delay={100} className="row" style={{ marginTop: '1.6rem' }}>
            <div className="row" role="group" aria-label="Filter by country">
              {COUNTRY_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`btn btn--sm ${activeCountry === c ? '' : 'btn--outline'}`}
                  aria-pressed={activeCountry === c}
                  onClick={() => setCountry(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="dest-search">
              Search destinations
            </label>
            <input
              id="dest-search"
              className="input"
              type="search"
              placeholder="Search destinations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 280 }}
            />
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
                    <div className="skeleton" style={{ height: 22, width: '70%', marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 14, width: '55%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="center" style={{ padding: '3rem 1rem' }}>
              <h3>No destinations match</h3>
              <p className="muted" style={{ marginTop: '0.6rem' }}>
                Try a different country filter or clear your search.
              </p>
              <button
                type="button"
                className="btn btn--outline"
                style={{ marginTop: '1.2rem' }}
                onClick={() => {
                  setQuery('');
                  setCountry('All');
                }}
              >
                Reset filters
              </button>
            </div>
          )}

          {!loading && !error && items.length > 0 && activeCountry === 'All' && (
            <>
              {grouped['Sri Lanka'].length > 0 && (
                <div style={{ marginBottom: 'clamp(36px, 5vw, 56px)' }}>
                  <div className="section-head">
                    <div className="section-head__text">
                      <div className="eyebrow">Sri Lanka</div>
                      <h2>The island</h2>
                    </div>
                    <span className="muted">{grouped['Sri Lanka'].length} places</span>
                  </div>
                  <div className="grid grid--3">
                    {grouped['Sri Lanka'].map((d, i) => (
                      <Reveal key={d.id || d.slug} delay={i * 55}>
                        <DestinationCard destination={d} />
                      </Reveal>
                    ))}
                  </div>
                </div>
              )}

              {grouped.Italy.length > 0 && (
                <div>
                  <div className="section-head">
                    <div className="section-head__text">
                      <div className="eyebrow">Italy</div>
                      <h2>The peninsula and islands</h2>
                    </div>
                    <span className="muted">{grouped.Italy.length} places</span>
                  </div>
                  <div className="grid grid--3">
                    {grouped.Italy.map((d, i) => (
                      <Reveal key={d.id || d.slug} delay={i * 55}>
                        <DestinationCard destination={d} />
                      </Reveal>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !error && items.length > 0 && activeCountry !== 'All' && (
            <div className="grid grid--3">
              {items.map((d, i) => (
                <Reveal key={d.id || d.slug} delay={i * 55}>
                  <DestinationCard destination={d} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
