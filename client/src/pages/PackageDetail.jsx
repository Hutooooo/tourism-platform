import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import ContactTiles from '../components/ContactTiles';
import { MediaPlaceholder } from '../components/DestinationCard';
import { DIRECTION_LABEL, formatPrice } from '../components/PackageCard';
import BookingForm from '../components/BookingForm';

export default function PackageDetail() {
  const { slug } = useParams();
  const { settings } = useSettings();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setActiveTab('overview');
    (async () => {
      try {
        const data = await api.get(`/packages/${slug}`);
        if (cancelled) return;
        setItem(data);
        setStatus('ready');
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useSeo(
    item
      ? { title: item.title, description: item.summary }
      : null
  );

  if (status === 'loading') {
    return (
      <div className="page-enter">
        <section className="section">
          <div className="container" aria-busy="true">
            <div className="skeleton" style={{ height: 48, width: '62%', marginBottom: 18 }} />
            <div className="skeleton" style={{ height: 320 }} />
          </div>
        </section>
      </div>
    );
  }

  if (status === 'error' || !item) {
    return (
      <div className="page-enter">
        <section className="section">
          <div className="container center">
            <div className="eyebrow">Not found</div>
            <h1>We could not find that tour</h1>
            <p className="lead" style={{ margin: '1rem auto 2rem' }}>{error}</p>
            <Link to="/packages" className="btn">
              Browse all tours
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const img = mediaUrl(item.image_url);
  const price = formatPrice(item.price_from, item.currency);
  const itinerary = Array.isArray(item.itinerary) ? item.itinerary : [];
  const includes = Array.isArray(item.includes) ? item.includes : [];
  const excludes = Array.isArray(item.excludes) ? item.excludes : [];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(itinerary.length ? [{ id: 'itinerary', label: `Itinerary (${itinerary.length})` }] : []),
    ...(includes.length || excludes.length ? [{ id: 'inclusions', label: 'What’s included' }] : []),
  ];

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          <nav aria-label="Breadcrumb" style={{ marginBottom: '1.2rem', fontSize: '0.9rem' }}>
            <Link to="/">Home</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/packages">Tours</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="muted">
              {item.title}
            </span>
          </nav>

          <Reveal>
            <div className="eyebrow">{DIRECTION_LABEL[item.direction] || 'Tour'}</div>
            <h1>{item.title}</h1>
            {item.summary && (
              <p className="lead" style={{ marginTop: '1rem' }}>
                {item.summary}
              </p>
            )}
            <div className="row" style={{ marginTop: '1.4rem' }}>
              {item.duration_days ? (
                <span className="pill" style={{ background: '#fff', color: 'var(--teal-800)', borderColor: 'var(--line)' }}>
                  {item.duration_days} days
                </span>
              ) : null}
              {price ? (
                <span className="pill" style={{ background: '#fff', color: 'var(--terracotta-600)', borderColor: 'var(--line)' }}>
                  from {price}
                </span>
              ) : null}
              {item.destination ? (
                <Link
                  to={`/destinations/${item.destination.slug}`}
                  className="pill"
                  style={{ background: '#fff', color: 'var(--teal-800)', borderColor: 'var(--line)', textDecoration: 'none' }}
                >
                  {item.destination.name}
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal variant="scale">
            <div className="split__media" style={{ marginBottom: 'clamp(26px, 4vw, 42px)' }}>
              {img ? (
                <img src={img} alt={item.title} style={{ aspectRatio: '21/9' }} />
              ) : (
                <div style={{ aspectRatio: '21/9' }}>
                  <MediaPlaceholder label={item.title} />
                </div>
              )}
            </div>
          </Reveal>

          {/* Tabs */}
          <div className="row" role="tablist" aria-label="Tour information" style={{ gap: '0.4rem', marginBottom: '1.6rem' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={activeTab === t.id}
                aria-controls={`panel-${t.id}`}
                className={`btn btn--sm ${activeTab === t.id ? '' : 'btn--outline'}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="split" style={{ alignItems: 'start' }}>
            <div>
              <div
                id="panel-overview"
                role="tabpanel"
                aria-labelledby="tab-overview"
                hidden={activeTab !== 'overview'}
                className="prose"
              >
                {item.description ? (
                  item.description.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <p className="muted">Detailed description coming shortly.</p>
                )}
              </div>

              <div
                id="panel-itinerary"
                role="tabpanel"
                aria-labelledby="tab-itinerary"
                hidden={activeTab !== 'itinerary'}
              >
                {itinerary.length > 0 && (
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
                    {itinerary.map((step, i) => (
                      <li key={i} className="card">
                        <div className="card__body" style={{ display: 'flex', gap: '1rem' }}>
                          <span
                            aria-hidden="true"
                            style={{
                              flex: 'none',
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background: 'var(--teal-50)',
                              color: 'var(--teal-700)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontFamily: 'var(--font-display)',
                            }}
                          >
                            {step.day || i + 1}
                          </span>
                          <span>
                            <strong style={{ display: 'block', color: 'var(--teal-900)' }}>
                              {step.title || `Day ${step.day || i + 1}`}
                            </strong>
                            {step.detail && <span className="muted">{step.detail}</span>}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div
                id="panel-inclusions"
                role="tabpanel"
                aria-labelledby="tab-inclusions"
                hidden={activeTab !== 'inclusions'}
              >
                <div className="grid grid--2">
                  {includes.length > 0 && (
                    <div className="card">
                      <div className="card__body">
                        <h3 style={{ marginBottom: '0.6rem' }}>Included</h3>
                        <ul className="feature-list">
                          {includes.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {excludes.length > 0 && (
                    <div className="card">
                      <div className="card__body">
                        <h3 style={{ marginBottom: '0.6rem' }}>Not included</h3>
                        <ul className="feature-list" style={{ ['--tick-color']: 'var(--danger)' }}>
                          {excludes.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Booking sidebar */}
            <div id="enquire">
              <div className="card" style={{ position: 'sticky', top: 'calc(var(--header-h) + 16px)' }}>
                <div className="card__body" style={{ padding: 'clamp(20px, 2.6vw, 28px)' }}>
                  <h3 style={{ marginBottom: '0.4rem' }}>Request this tour</h3>
                  <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.2rem' }}>
                    Send a request and we will come back with availability and a tailored quote. Nothing
                    is charged here.
                  </p>

                  {settings.booking_enabled ? (
                    <BookingForm packageSlug={item.slug} direction={item.direction} travellersHint={1} />
                  ) : (
                    <div className="alert alert--info">
                      Online requests are temporarily closed — please contact us directly below.
                    </div>
                  )}

                  <hr className="divider" style={{ marginBlock: '1.4rem' }} />
                  <h4 style={{ marginBottom: '0.8rem' }}>Or reach us directly</h4>
                  <ContactTiles variant="compact" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
