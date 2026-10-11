import { Link } from 'react-router-dom';
import { mediaUrl } from '../api/client';
import { MediaPlaceholder } from './DestinationCard';

const DIRECTION_LABEL = {
  SL_TO_IT: 'Sri Lanka → Italy',
  IT_TO_SL: 'Italy → Sri Lanka',
  BOTH: 'Both directions',
};

function formatPrice(price, currency) {
  if (price === null || price === undefined || price === '') return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  try {
    // Whole amounts stay compact ("€1,200"); cents only appear when entered.
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency || 'EUR'} ${price}`;
  }
}

export { DIRECTION_LABEL, formatPrice };

export default function PackageCard({ pkg }) {
  const img = mediaUrl(pkg.image_url);
  const price = formatPrice(pkg.price_from, pkg.currency);

  return (
    <article className="card">
      <Link to={`/packages/${pkg.slug}`} className="card-link">
        <div className="card__media">
          {img ? (
            <img src={img} alt={pkg.title} loading="lazy" decoding="async" />
          ) : (
            <MediaPlaceholder label={pkg.title?.slice(0, 1)} />
          )}
          <span className="card__badge">{DIRECTION_LABEL[pkg.direction] || 'Tour'}</span>
        </div>
        <div className="card__body">
          <h3 className="card__title">{pkg.title}</h3>
          <p className="card__text">{pkg.summary}</p>
          <div className="card__meta">
            {pkg.duration_days ? (
              <span>
                <strong>{pkg.duration_days}</strong> days
              </span>
            ) : null}
            {pkg.destination_name && <span>{pkg.destination_name}</span>}
            {price && <span className="card__price">from {price}</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
