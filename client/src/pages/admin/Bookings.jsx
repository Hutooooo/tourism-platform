import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';
import { TextField, SelectField, Alert } from '../../components/FormField';

const STATUSES = ['pending', 'confirmed', 'declined', 'completed'];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
];

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v.endsWith('Z') || v.includes('T') ? v : `${v}Z`).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return v;
  }
}

export default function Bookings() {
  useSeo({ title: 'Bookings' });

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (debounced) params.set('q', debounced);
      const [list, cts] = await Promise.all([
        api.get(`/bookings?${params}`),
        api.get('/bookings/counts'),
      ]);
      setItems(list);
      setCounts(cts);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id, nextStatus) {
    setBusy(true);
    try {
      await api.patch(`/bookings/${id}/status`, { status: nextStatus });
      setItems((prev) => prev.map((b) => (b.id === id ? { ...b, status: nextStatus } : b)));
      if (selected && selected.id === id) setSelected((s) => ({ ...s, status: nextStatus }));
      const cts = await api.get('/bookings/counts');
      setCounts(cts);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this booking request? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.del(`/bookings/${id}`);
      setItems((prev) => prev.filter((b) => b.id !== id));
      if (selected && selected.id === id) setSelected(null);
      setCounts(await api.get('/bookings/counts'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Requests</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Bookings</h1>
        </div>
        {counts && (
          <div className="row" style={{ fontSize: '0.88rem' }}>
            {STATUSES.map((s) => (
              <span key={s} className={`badge badge--${s}`}>
                {s}: {counts[s] || 0}
              </span>
            ))}
          </div>
        )}
      </div>

      <Alert type="error">{error}</Alert>

      <div className="row" style={{ marginBottom: '1.2rem' }}>
        <div style={{ maxWidth: 240, flex: '1 1 200px' }}>
          <SelectField
            id="bk-filter"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div style={{ maxWidth: 280, flex: '1 1 220px' }}>
          <TextField
            id="bk-q"
            label="Search"
            type="search"
            placeholder="Name, email, package…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div aria-busy="true" className="stack">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 62 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="card__body center" style={{ padding: '3rem 1rem' }}>
            <h3>No bookings found</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              {status || debounced ? 'Try clearing your filters.' : 'Requests submitted from the site will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <caption className="sr-only">Booking requests</caption>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>Ref</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>Traveller</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>Package</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>Travel date</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>People</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>Received</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}>Status</th>
                  <th scope="col" style={{ padding: '0.9rem 1rem' }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--teal-700)' }}>
                      BK-{String(b.id).padStart(5, '0')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <strong>{b.name}</strong>
                      <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>{b.email}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', maxWidth: 220 }}>
                      {b.package_title}
                      <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
                        {b.direction.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>{b.travel_date || '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      {b.adults}A {b.children > 0 ? `${b.children}C` : ''}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>{fmtDate(b.created_at)}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`badge badge--${b.status}`}>{b.status}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => setSelected(b)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(6,42,38,0.55)' }}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="card" role="dialog" aria-modal="true" aria-label={`Booking ${selected.id}`} style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', overflow: 'auto' }}>
            <div className="card__body" style={{ padding: 'clamp(22px, 3vw, 30px)' }}>
              <div className="row row--between" style={{ marginBottom: '1rem' }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>Booking request</div>
                  <h2 style={{ fontSize: '1.4rem' }}>BK-{String(selected.id).padStart(5, '0')}</h2>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.55rem 1.2rem', fontSize: '0.94rem', marginBottom: '1.4rem' }}>
                <dt className="muted">Name</dt><dd><strong>{selected.name}</strong></dd>
                <dt className="muted">Email</dt>
                <dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd>
                <dt className="muted">Phone</dt>
                <dd>{selected.phone ? <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}>{selected.phone}</a> : '—'}</dd>
                <dt className="muted">Package</dt><dd>{selected.package_title}</dd>
                <dt className="muted">Direction</dt><dd>{selected.direction.replace(/_/g, ' ')}</dd>
                <dt className="muted">Travel date</dt><dd>{selected.travel_date || 'Flexible / not stated'}</dd>
                <dt className="muted">Party</dt><dd>{selected.adults} adult(s), {selected.children} child(ren)</dd>
                <dt className="muted">Received</dt><dd>{fmtDate(selected.created_at)}</dd>
              </dl>

              {selected.notes && (
                <div className="alert alert--info" style={{ whiteSpace: 'pre-wrap' }}>
                  {selected.notes}
                </div>
              )}

              <div className="field">
                <label className="field__label" htmlFor="status-select">Update status</label>
                <select
                  id="status-select"
                  className="select"
                  value={selected.status}
                  disabled={busy}
                  onChange={(e) => updateStatus(selected.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="row" style={{ marginTop: '1.2rem' }}>
                <a className="btn btn--outline btn--sm" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Your enquiry — BK-${String(selected.id).padStart(5, '0')}`)}`}>
                  Reply by email
                </a>
                {selected.phone && (
                  <a
                    className="btn btn--outline btn--sm"
                    href={`https://wa.me/${selected.phone.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  style={{ marginLeft: 'auto' }}
                  disabled={busy}
                  onClick={() => remove(selected.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
