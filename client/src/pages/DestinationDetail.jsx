import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import PackageCard from '../components/PackageCard';
import ContactTiles from '../components/ContactTiles';
import { MediaPlaceholder } from '../components/DestinationCard';

export default function DestinationDetail() {
  const { slug } = useParams();
  const { settings } = useSettings();
  const [item, setItem] = useState(null);
  const [related, setRelated] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const data = await api.get(`/destinations/${slug}`);
        if (cancelled) return;
        setItem(data);
        setStatus('ready');
        setError(null);

        if (data.id) {
          try {
            const pkgs = await api.get(`/packages?destination_id=${data.id}`);
            if (!cancelled) setRelated(pkgs);
          } catch {
            if (!cancelled) setRelated([]);
          }
        }
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
          title: item.name,
          description: item.summary,
          og: { title: item.name, description: item.summary, type: 'article', siteName: settings.brand_name },
        }
      : null
  );

  if (status === 'loading') {
    return (
      <div className="page-enter">
        <section className="section">
          <div className="container" aria-busy="true">
            <div className="skeleton" style={{ height: 46, width: '55%', marginBottom: 20 }} />
            <div className="skeleton" style={{ height: 340, marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 18, width: '90%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 18, width: '78%' }} />
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
            <h1>We could not find that destination</h1>
            <p className="lead" style={{ margin: '1rem auto 2rem' }}>{error}</p>
            <Link to="/destinations" className="btn">
              Browse all destinations
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const img = mediaUrl(item.image_url);

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          <nav aria-label="Breadcrumb" style={{ marginBottom: '1.2rem', fontSize: '0.9rem' }}>
            <Link to="/">Home</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/destinations">Destinations</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="muted">
              {item.name}
            </span>
          </nav>

          <Reveal>
            <div className="eyebrow">
              {item.country}
              {item.region ? ` · ${item.region}` : ''}
            </div>
            <h1>{item.name}</h1>
            {item.summary && (
              <p className="lead" style={{ marginTop: '1rem' }}>
                {item.summary}
              </p>
            )}
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal variant="scale">
            <div className="split__media" style={{ marginBottom: 'clamp(28px, 4vw, 46px)' }}>
              {img ? (
                <img src={img} alt={item.name} style={{ aspectRatio: '21/9' }} />
              ) : (
                <div style={{ aspectRatio: '21/9' }}>
                  <MediaPlaceholder label={item.name} />
                </div>
              )}
            </div>
          </Reveal>

          <div className="split" style={{ alignItems: 'start' }}>
            <Reveal variant="left">
              <div className="prose">
                {item.description ? (
                  item.description.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)
                ) : (
                  <p className="muted">More information about this destination will be added shortly.</p>
                )}
              </div>
            </Reveal>

            <Reveal variant="right">
              {item.highlights && item.highlights.length > 0 && (
                <div className="card">
                  <div className="card__body">
                    <h3 style={{ marginBottom: '0.4rem' }}>Highlights</h3>
                    <ul className="feature-list">
                      {item.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: '1.6rem' }}>
                      <Link to={`/packages?destination=${item.slug}`} className="btn btn--block">
                        Tours covering this destination
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section--warm">
          <div className="container">
            <div className="section-head">
              <Reveal className="section-head__text">
                <div className="eyebrow">Related tours</div>
                <h2>Packages that include {item.name}</h2>
              </Reveal>
            </div>
            <div className="grid grid--3">
              {related.map((p, i) => (
                <Reveal key={p.id || p.slug} delay={i * 60}>
                  <PackageCard pkg={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="card" style={{ border: 0, boxShadow: 'var(--shadow)' }}>
              <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 36px)' }}>
                <h3 style={{ marginBottom: '1rem' }}>Ask about {item.name}</h3>
                <ContactTiles variant="compact" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
