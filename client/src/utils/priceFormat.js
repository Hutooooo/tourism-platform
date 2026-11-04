/**
 * Format a single price value.
 */
export function formatPrice(price, currency) {
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

/**
 * Format a price range from a package object.
 */
export function formatPriceRange(pkg) {
  const min = formatPrice(pkg.price_from, pkg.currency);
  if (!min) return null;
  const max = formatPrice(pkg.price_max, pkg.currency);
  return max ? `${min} – ${max}` : min;
}