import { Link } from 'react-router-dom';
import { mediaUrl } from '../api/client';
import { MediaPlaceholder } from './DestinationCard';

const DIRECTION_LABEL = {
  SL_TO_IT: 'Sri Lanka → Italy',
  IT_TO_SL: 'Italy → Sri Lanka',
  BOTH: 'Both directions',
};

const PRICING_STATUS_CHIP = {
  supplier_verified: { className: 'badge--confirmed', label: 'Verified' },
  unavailable: { className: 'badge--declined', label: 'Temporarily unavailable' },
  indicative: { className: 'badge--pending', label: 'Estimate' },
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

function formatPriceRange(pkg) {
  const min = formatPrice(pkg.price_from, pkg.currency);
  if (!min) return null;
  const max = formatPrice(pkg.price_max, pkg.currency);
  return max ? `${min} – ${max}` : min;
}

export { DIRECTION_LABEL, formatPrice, formatPriceRange };

export default function PackageCard({ pkg }) {
  const img = pkg.image_url;
  const priceRange = formatPriceRange(pkg);
  const cities = (pkg.destinations_list || []).slice(0, 3);
  const chip = PRICING_STATUS_CHIP[pkg.pricing_status];

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
                {pkg.duration_nights != null ? ` / ${pkg.duration_nights} nights` : ''}
              </span>
            ) : null}
            {cities.length > 0 ? <span>{cities.join(', ')}</span> : pkg.destination_name ? <span>{pkg.destination_name}</span> : null}
            {priceRange && <span className="card__price">{priceRange}</span>}
          </div>
          {chip && (
            <span className={`badge ${chip.className}`} style={{ marginTop: '0.55rem', display: 'inline-block' }}>
              {chip.label}
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
