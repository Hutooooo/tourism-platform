import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';
import { TextField, SelectField, Alert } from '../../components/FormField';

const STATUSES = ['new', 'read', 'replied', 'archived'];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
];

const TYPE_LABELS = {
  'custom-tour': 'Custom tour',
  general: 'General',
  partnership: 'Partnership',
  other: 'Other',
};

function fmtDateTime(v) {
  if (!v) return '—';
  try {
    const d = new Date(v.endsWith('Z') || v.includes('T') ? v : `${v}Z`);
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return v;
  }
}

export default function Inquiries() {
  useSeo({ title: 'Inquiries' });

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
        api.get(`/inquiries?${params}`),
        api.get('/inquiries/counts'),
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

  /**
   * Opening a message marks it read server-side; reflect that locally so
   * the badge updates without a full reload.
   */
  async function open(item) {
    try {
      const fresh = await api.get(`/inquiries/${item.id}`);
      setSelected(fresh);
      setItems((prev) => prev.map((i) => (i.id === fresh.id ? { ...i, status: fresh.status } : i)));
      const cts = await api.get('/inquiries/counts');
      setCounts(cts);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(id, next) {
    setBusy(true);
    try {
      await api.patch(`/inquiries/${id}/status`, { status: next });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: next } : i)));
      if (selected && selected.id === id) setSelected((s) => ({ ...s, status: next }));
      setCounts(await api.get('/inquiries/counts'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.del(`/inquiries/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selected && selected.id === id) setSelected(null);
      setCounts(await api.get('/inquiries/counts'));
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
          <div className="eyebrow">Inbox</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Inquiries</h1>
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
            id="inq-filter"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div style={{ maxWidth: 280, flex: '1 1 220px' }}>
          <TextField
            id="inq-q"
            label="Search"
            type="search"
            placeholder="Name, subject, message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="stack" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 62 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="card__body center" style={{ padding: '3rem 1rem' }}>
            <h3>No messages</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              {status || debounced ? 'Try clearing your filters.' : 'Messages sent from the contact form will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((i) => (
              <li
                key={i.id}
                style={{
                  borderBottom: '1px solid var(--line)',
                  padding: '1rem clamp(14px, 2vw, 20px)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  background: i.status === 'new' ? 'rgba(212,122,98,0.05)' : 'transparent',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: '0.6rem', marginBottom: '0.2rem' }}>
                    <strong>{i.name}</strong>
                    <span className={`badge badge--${i.status}`}>{i.status}</span>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {TYPE_LABELS[i.type] || i.type}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: '0.9rem' }}>
                    {i.subject || <em>No subject</em>} · {i.email}
                  </div>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.35rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {i.message}
                  </p>
                </div>
                <div className="row" style={{ gap: '0.5rem', flex: 'none' }}>
                  <span className="muted" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(i.created_at)}
                  </span>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => open(i)}>
                    Read
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(6,42,38,0.55)' }}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="card" role="dialog" aria-modal="true" aria-label="Message" style={{ width: '100%', maxWidth: 600, maxHeight: '86vh', overflow: 'auto' }}>
            <div className="card__body" style={{ padding: 'clamp(22px, 3vw, 30px)' }}>
              <div className="row row--between" style={{ marginBottom: '1rem' }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>{TYPE_LABELS[selected.type] || selected.type}</div>
                  <h2 style={{ fontSize: '1.35rem' }}>{selected.subject || 'No subject'}</h2>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.2rem', fontSize: '0.93rem', marginBottom: '1.2rem' }}>
                <dt className="muted">From</dt><dd><strong>{selected.name}</strong></dd>
                <dt className="muted">Email</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd>
                <dt className="muted">Phone</dt>
                <dd>{selected.phone ? <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}>{selected.phone}</a> : '—'}</dd>
                <dt className="muted">Received</dt><dd>{fmtDateTime(selected.created_at)}</dd>
                <dt className="muted">Status</dt><dd><span className={`badge badge--${selected.status}`}>{selected.status}</span></dd>
              </dl>

              <div style={{ background: 'var(--paper-warm)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.1rem', whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
                {selected.message}
              </div>

              <div className="field" style={{ marginTop: '1.3rem' }}>
                <label className="field__label" htmlFor="inq-status">Update status</label>
                <select
                  id="inq-status"
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

              <div className="row" style={{ marginTop: '1.1rem' }}>
                <a
                  className="btn btn--outline btn--sm"
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject || 'Your message'}`)}`}
                >
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
