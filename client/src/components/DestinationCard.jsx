import { Link } from 'react-router-dom';
import { mediaUrl } from '../api/client';

/** Placeholder gradient when a destination has no image yet. */
export function MediaPlaceholder({ label }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #eef6f4 0%, #f4f1ea 100%)',
        color: '#10514a',
        fontFamily: 'var(--font-display)',
        fontSize: '1.4rem',
        letterSpacing: '0.04em',
      }}
      aria-hidden="true"
    >
      {label || '◆'}
    </div>
  );
}

export default function DestinationCard({ destination }) {
  const d = destination;
  const img = mediaUrl(d.image_url);

  return (
    <article className="card">
      <Link to={`/destinations/${d.slug}`} className="card-link">
        <div className="card__media">
          {img ? (
            <img src={img} alt={d.name} loading="lazy" decoding="async" />
          ) : (
            <MediaPlaceholder label={d.name?.slice(0, 1)} />
          )}
          <span className={`card__badge${d.country === 'Italy' ? ' card__badge--terracotta' : ''}`}>{d.country}</span>
        </div>
        <div className="card__body">
          <h3 className="card__title">{d.name}</h3>
          <p className="card__text">{d.summary}</p>
          {d.highlights && d.highlights.length > 0 && (
            <div className="card__meta">
              <span>
                <strong>{d.highlights.length}</strong> highlights
              </span>
              {d.region && <span>{d.region}</span>}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
