import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, mediaUrl } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import ContactTiles from '../components/ContactTiles';
import { MediaPlaceholder } from '../components/DestinationCard';
import { DIRECTION_LABEL, formatPrice, formatPriceRange } from '../components/PackageCard';
import BookingForm from '../components/BookingForm';

const PRICING_STATUS_LABEL = {
  indicative: 'Indicative estimate — confirmation required',
  supplier_verified: 'Supplier-verified price',
  unavailable: 'Temporarily unavailable — enquire for alternatives',
};

const PRICING_STATUS_BADGE = {
  indicative: 'badge--pending',
  supplier_verified: 'badge--confirmed',
  unavailable: 'badge--declined',
};

function FactRow({ label, children }) {
  if (!children) return null;
  return (
    <div style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--line)' }}>
      <dt className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </dt>
      <dd style={{ margin: '0.15rem 0 0' }}>{children}</dd>
    </div>
  );
}

export default function PackageDetail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const previewMode = searchParams.get('preview') === '1';
  const { settings } = useSettings();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setActiveTab('overview');
    setBannerDismissed(false);
    (async () => {
      try {
        // When preview=1 the request carries the in-memory admin access
        // token (the api wrapper attaches it), so a signed-in administrator
        // can view unpublished or archived packages before publishing.
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
      ? {
          title: item.seo_title || item.title,
          description: item.seo_description || item.summary,
        }
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
  const priceRange = formatPriceRange(item);
  const singlePrice = formatPrice(item.price_from, item.currency);
  const itinerary = Array.isArray(item.itinerary) ? item.itinerary : [];
  const includes = Array.isArray(item.includes) ? item.includes : [];
  const excludes = Array.isArray(item.excludes) ? item.excludes : [];
  const cities = Array.isArray(item.destinations_list) ? item.destinations_list : [];
  const addOns = Array.isArray(item.add_ons) ? item.add_ons : [];
  const disclaimer = item.disclaimer || settings.pricing_disclaimer || '';
  const statusLabel = PRICING_STATUS_LABEL[item.pricing_status];
  const statusBadge = PRICING_STATUS_BADGE[item.pricing_status];
  const isPreview = previewMode && (!item.published || item.archived) && !bannerDismissed;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(itinerary.length ? [{ id: 'itinerary', label: `Itinerary (${itinerary.length})` }] : []),
    ...(includes.length || excludes.length || addOns.length ? [{ id: 'inclusions', label: 'What’s included' }] : []),
  ];

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          {isPreview && (
            <div
              className="alert alert--info"
              style={{ marginBottom: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}
              role="status"
            >
              <span>
                <strong>Preview</strong> — this package is{' '}
                {item.archived ? 'archived' : 'not published'} and invisible to the public.
              </span>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setBannerDismissed(true)}>
                Dismiss
              </button>
            </div>
          )}

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
            <div className="row" style={{ marginTop: '1.4rem', gap: '0.5rem', flexWrap: 'wrap' }}>
              {item.duration_days ? (
                <span className="pill" style={{ background: '#fff', color: 'var(--teal-800)', borderColor: 'var(--line)' }}>
                  {item.duration_days} days
                  {item.duration_nights != null ? ` · ${item.duration_nights} nights` : ''}
                </span>
              ) : null}
              {priceRange ? (
                <span className="pill" style={{ background: '#fff', color: 'var(--terracotta-600)', borderColor: 'var(--line)' }}>
                  {item.price_max != null ? priceRange : `from ${singlePrice}`}
                </span>
              ) : null}
              {cities.map((c) => (
                <span
                  key={c}
                  className="pill"
                  style={{ background: '#fff', color: 'var(--teal-800)', borderColor: 'var(--line)' }}
                >
                  {c}
                </span>
              ))}
              {item.destination && cities.length === 0 ? (
                <Link
                  to={`/destinations/${item.destination.slug}`}
                  className="pill"
                  style={{ background: '#fff', color: 'var(--teal-800)', borderColor: 'var(--line)', textDecoration: 'none' }}
                >
                  {item.destination.name}
                </Link>
              ) : null}
              {statusBadge && statusLabel && (
                <span className={`badge ${statusBadge}`} style={{ alignSelf: 'center' }}>
                  {statusLabel}
                </span>
              )}
              <a href="#enquire" className="btn btn--brass btn--sm" style={{ marginLeft: 'auto' }}>
                Enquire about this package
              </a>
            </div>
            {disclaimer && (
              <p
                className="muted"
                style={{ marginTop: '1.1rem', fontSize: '0.85rem', maxWidth: '62ch', lineHeight: 1.55 }}
              >
                {disclaimer}
              </p>
            )}
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

                {(item.accommodation ||
                  item.accommodation_category ||
                  item.group_size_min ||
                  item.group_size_max ||
                  item.seasonal_notes ||
                  item.lead_time ||
                  item.cancellation_policy ||
                  item.occupancy_note) && (
                  <div className="card" style={{ marginTop: '1.4rem' }}>
                    <div className="card__body">
                      <h3 style={{ marginBottom: '0.5rem' }}>Good to know</h3>
                      <dl style={{ margin: 0 }}>
                        <FactRow label="Accommodation">{item.accommodation}</FactRow>
                        <FactRow label="Category">
                          {item.accommodation_category
                            ? item.accommodation_category.charAt(0).toUpperCase() +
                              item.accommodation_category.slice(1)
                            : null}
                        </FactRow>
                        <FactRow label="Pricing">{item.occupancy_note}</FactRow>
                        <FactRow label="Group size">
                          {item.group_size_min && item.group_size_max
                            ? `${item.group_size_min}–${item.group_size_max} travellers`
                            : item.group_size_min
                              ? `From ${item.group_size_min} travellers`
                              : item.group_size_max
                                ? `Up to ${item.group_size_max} travellers`
                                : null}
                        </FactRow>
                        <FactRow label="Season">{item.seasonal_notes}</FactRow>
                        <FactRow label="Booking lead time">{item.lead_time}</FactRow>
                        <FactRow label="Cancellation">{item.cancellation_policy}</FactRow>
                      </dl>
                    </div>
                  </div>
                )}

                {disclaimer && (
                  <p className="muted" style={{ marginTop: '1.4rem', fontSize: '0.85rem', lineHeight: 1.55 }}>
                    {disclaimer}
                  </p>
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
                    {itinerary.map((step, i) => {
                      const stepImg = step.image ? mediaUrl(step.image) : null;
                      return (
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
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: 'block', color: 'var(--teal-900)' }}>
                                {step.title || `Day ${step.day || i + 1}`}
                              </strong>
                              {step.detail && <span className="muted">{step.detail}</span>}
                              {stepImg && (
                                <img
                                  src={stepImg}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  style={{
                                    display: 'block',
                                    marginTop: '0.7rem',
                                    width: '100%',
                                    maxWidth: 420,
                                    aspectRatio: '16/9',
                                    objectFit: 'cover',
                                    borderRadius: 10,
                                  }}
                                />
                              )}
                            </span>
                          </div>
                        </li>
                      );
                    })}
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
                {addOns.length > 0 && (
                  <div className="card" style={{ marginTop: '1rem' }}>
                    <div className="card__body">
                      <h3 style={{ marginBottom: '0.6rem' }}>Optional add-ons</h3>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.7rem' }}>
                        {addOns.map((a, i) => (
                          <li key={i} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                            <strong>{a.name}</strong>
                            {a.description && <span className="muted" style={{ flex: 1, minWidth: 180 }}>{a.description}</span>}
                            {a.price != null && (
                              <span style={{ color: 'var(--terracotta-600)', whiteSpace: 'nowrap' }}>
                                {formatPrice(a.price, a.currency || item.currency)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.9rem' }}>
                        Add-ons are optional and confirmed with your final quotation.
                      </p>
                    </div>
                  </div>
                )}
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
