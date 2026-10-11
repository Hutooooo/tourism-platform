import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';

function StatTile({ label, value, tone, to, hint }) {
  const toneStyles = {
    teal: { background: 'var(--teal-800)', color: '#fff', accent: 'var(--brass-500)' },
    brass: { background: 'var(--brass-500)', color: 'var(--teal-900)', accent: 'var(--teal-900)' },
    terracotta: { background: 'var(--terracotta-600)', color: '#fff', accent: '#fff' },
    plain: { background: '#fff', color: 'var(--teal-900)', accent: 'var(--terracotta-600)' },
  };
  const t = toneStyles[tone] || toneStyles.plain;

  const body = (
    <div
      style={{
        background: t.background,
        color: t.color,
        borderRadius: 'var(--radius)',
        padding: 'clamp(18px, 2.4vw, 26px)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        border: tone === 'plain' ? '1px solid var(--line)' : 'none',
        transition: 'transform .25s var(--ease), box-shadow .25s var(--ease)',
      }}
    >
      <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.78 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.9rem, 1.5rem + 1.4vw, 2.6rem)', fontWeight: 600, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: '0.84rem', opacity: 0.78 }}>{hint}</div>}
    </div>
  );

  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{body}</Link> : body;
}

function MiniChart({ series }) {
  if (!series || series.length === 0) return null;
  const max = Math.max(1, ...series.map((s) => s.bookings + s.inquiries));
  const w = 100;
  const h = 34;
  const step = series.length > 1 ? w / (series.length - 1) : w;

  const path = (key) =>
    series
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(h - (s[key] / max) * h).toFixed(2)}`)
      .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={110} preserveAspectRatio="none" role="img" aria-label="Submissions over the last 30 days">
      <path d={`${path('inquiries')} L${w},${h} L0,${h} Z`} fill="rgba(24,107,98,0.14)" />
      <path d={path('inquiries')} fill="none" stroke="#186b62" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      <path d={path('bookings')} fill="none" stroke="#c2604a" strokeWidth="0.9" vectorEffect="non-scaling-stroke" strokeDasharray="3 2" />
    </svg>
  );
}

export default function Overview() {
  useSeo({ title: 'Dashboard' });

  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ov, fn, tl, rc] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/funnel'),
          api.get('/analytics/timeline?days=30'),
          api.get('/analytics/recent'),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setFunnel(fn);
        setTimeline(tl);
        setRecent(rc);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div aria-busy="true">
        <div className="skeleton" style={{ height: 40, width: 240, marginBottom: 24 }} />
        <div className="grid grid--4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!overview) return null;

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Overview</h1>
        </div>
        <div className="row">
          <Link to="/admin/destinations" className="btn btn--outline btn--sm">+ New destination</Link>
          <Link to="/admin/packages" className="btn btn--sm">+ New package</Link>
        </div>
      </div>

      <div className="grid grid--4" style={{ marginBottom: 'clamp(24px, 3vw, 36px)' }}>
        <StatTile
          label="New inquiries"
          value={overview.inquiriesNew}
          hint={`${overview.inquiries} total`}
          tone="terracotta"
          to="/admin/inquiries"
        />
        <StatTile
          label="Pending bookings"
          value={overview.bookingsPending}
          hint={`${overview.bookings} total`}
          tone="teal"
          to="/admin/bookings"
        />
        <StatTile
          label="Destinations"
          value={overview.destinationsPublished}
          hint={`${overview.destinations - overview.destinationsPublished} drafts`}
          tone="plain"
          to="/admin/destinations"
        />
        <StatTile
          label="Packages"
          value={overview.packagesPublished}
          hint={`${overview.packages - overview.packagesPublished} drafts`}
          tone="brass"
          to="/admin/packages"
        />
      </div>

      <div className="grid grid--2" style={{ marginBottom: 'clamp(24px, 3vw, 36px)' }}>
        <div className="card">
          <div className="card__body">
            <h3 style={{ marginBottom: '0.3rem' }}>Submissions, last 30 days</h3>
            <p className="muted" style={{ fontSize: '0.86rem', marginBottom: '1rem' }}>
              <span style={{ color: '#186b62' }}>—</span> inquiries &nbsp;·&nbsp;
              <span style={{ color: '#c2604a' }}>--</span> booking requests
            </p>
            <MiniChart series={timeline && timeline.series} />
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <h3 style={{ marginBottom: '0.9rem' }}>Booking outcomes</h3>
            <div className="stack">
              {['pending', 'confirmed', 'declined', 'completed'].map((s) => {
                const n = (funnel && funnel.bookings.byStatus[s]) || 0;
                const total = (funnel && funnel.bookings.total) || 0;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={s}>
                    <div className="row row--between" style={{ fontSize: '0.88rem', marginBottom: 4 }}>
                      <span style={{ textTransform: 'capitalize' }}>{s}</span>
                      <strong>{n}</strong>
                    </div>
                    <div style={{ height: 8, background: 'var(--paper-warm)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 99,
                          background: s === 'confirmed' ? 'var(--success)' : s === 'pending' ? 'var(--brass-500)' : s === 'declined' ? 'var(--danger)' : 'var(--teal-600)',
                          transition: 'width .6s var(--ease)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {funnel && (
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                Confirmed rate: <strong>{funnel.conversion.confirmedRate}%</strong>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__body">
            <div className="row row--between" style={{ marginBottom: '0.9rem' }}>
              <h3>Latest bookings</h3>
              <Link to="/admin/bookings" className="btn btn--outline btn--sm">View all</Link>
            </div>
            {recent && recent.bookings.length === 0 && <p className="muted">No bookings yet.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.7rem' }}>
              {(recent ? recent.bookings : []).map((b) => (
                <li key={b.id} className="row row--between" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: '0.6rem' }}>
                  <span>
                    <strong>{b.name}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: '0.84rem' }}>
                      {b.package_title}
                    </span>
                  </span>
                  <span className={`badge badge--${b.status}`}>{b.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <div className="row row--between" style={{ marginBottom: '0.9rem' }}>
              <h3>Latest inquiries</h3>
              <Link to="/admin/inquiries" className="btn btn--outline btn--sm">View all</Link>
            </div>
            {recent && recent.inquiries.length === 0 && <p className="muted">No inquiries yet.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.7rem' }}>
              {(recent ? recent.inquiries : []).map((i) => (
                <li key={i.id} className="row row--between" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: '0.6rem' }}>
                  <span>
                    <strong>{i.name}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: '0.84rem' }}>
                      {i.subject || i.email}
                    </span>
                  </span>
                  <span className={`badge badge--${i.status}`}>{i.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
