import { useCallback, useEffect, useState } from 'react';
import { api, mediaUrl } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';
import { TextField, TextArea, SelectField, Alert } from '../../components/FormField';
import ImagePicker from '../../components/ImagePicker';

const DIRECTION_OPTIONS = [
  { value: 'SL_TO_IT', label: 'Sri Lanka → Italy' },
  { value: 'IT_TO_SL', label: 'Italy → Sri Lanka' },
  { value: 'BOTH', label: 'Both directions' },
];

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'LKR', label: 'LKR' },
];

const EMPTY = {
  title: '',
  direction: 'BOTH',
  destination_id: '',
  summary: '',
  description: '',
  duration_days: '',
  price_from: '',
  currency: 'EUR',
  itinerary: '',
  includes: '',
  excludes: '',
  image_url: '',
  featured: false,
  published: true,
  slug: '',
};

const parseList = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Itinerary is edited as "Day | Title | Detail" lines and stored as an
 * array of { day, title, detail } objects.
 */
const parseItinerary = (text) =>
  parseList(text).map((line) => {
    const [day, title, ...rest] = line.split('|').map((s) => s.trim());
    const parsedDay = parseInt(day, 10);
    return {
      day: Number.isFinite(parsedDay) ? parsedDay : undefined,
      title: title || day,
      detail: rest.join(' | ') || '',
    };
  });

const formatItinerary = (arr) =>
  (arr || [])
    .map((s) => `${s.day ?? ''} | ${s.title || ''} | ${s.detail || ''}`)
    .join('\n');

export default function PackagesAdmin() {
  useSeo({ title: 'Packages — Dashboard' });

  const [items, setItems] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgs, dests] = await Promise.all([
        api.get('/packages?all=1'),
        api.get('/destinations?all=1'),
      ]);
      setItems(pkgs);
      setDestinations(dests);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      direction: item.direction || 'BOTH',
      destination_id: item.destination_id || '',
      summary: item.summary || '',
      description: item.description || '',
      duration_days: item.duration_days ?? '',
      price_from: item.price_from ?? '',
      currency: item.currency || 'EUR',
      itinerary: formatItinerary(item.itinerary),
      includes: (item.includes || []).join('\n'),
      excludes: (item.excludes || []).join('\n'),
      image_url: item.image_url || '',
      featured: !!item.featured,
      published: !!item.published,
      slug: item.slug || '',
    });
    setFieldErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setFieldErrors({});
    setShowForm(false);
  }

  function validate() {
    const errs = {};
    if (!form.title.trim() || form.title.trim().length < 3) errs.title = 'Title is required (at least 3 characters).';
    if (!form.direction) errs.direction = 'Choose a direction.';
    if (form.duration_days !== '' && (Number(form.duration_days) < 1 || Number(form.duration_days) > 365)) {
      errs.duration_days = 'Between 1 and 365 days.';
    }
    if (form.price_from !== '' && Number(form.price_from) < 0) errs.price_from = 'Cannot be negative.';
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      errs.slug = 'Lowercase letters, numbers and hyphens only.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setNotice(null);
    if (!validate()) return;

    const payload = {
      title: form.title.trim(),
      direction: form.direction,
      destination_id: form.destination_id ? Number(form.destination_id) : null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      duration_days: form.duration_days === '' ? null : Number(form.duration_days),
      price_from: form.price_from === '' ? null : Number(form.price_from),
      currency: form.currency,
      itinerary: parseItinerary(form.itinerary),
      includes: parseList(form.includes),
      excludes: parseList(form.excludes),
      image_url: form.image_url || null,
      featured: form.featured,
      published: form.published,
      ...(form.slug ? { slug: form.slug } : {}),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/packages/${editingId}`, payload);
        setNotice({ type: 'success', text: 'Package updated.' });
      } else {
        await api.post('/packages', payload);
        setNotice({ type: 'success', text: 'Package created.' });
      }
      resetForm();
      await load();
    } catch (err) {
      if (err.details && typeof err.details === 'object') setFieldErrors(err.details);
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try {
      await api.del(`/packages/${item.id}`);
      setNotice({ type: 'success', text: 'Package deleted.' });
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  const destOptions = [{ value: '', label: '— None —' }, ...destinations.map((d) => ({ value: d.id, label: d.name }))];

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Content</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Packages</h1>
        </div>
        <button type="button" className="btn" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Close form' : '+ New package'}
        </button>
      </div>

      <Alert type="error">{error}</Alert>
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      {showForm && (
        <div className="card" style={{ marginBottom: 'clamp(24px, 3vw, 36px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1.1rem' }}>
              {editingId ? 'Edit package' : 'New package'}
            </h2>

            <form onSubmit={onSubmit} noValidate>
              <div className="form-grid">
                <TextField
                  id="p-title"
                  label="Title"
                  required
                  value={form.title}
                  onChange={set('title')}
                  error={fieldErrors.title}
                  maxLength={180}
                  placeholder="Sri Lanka Highlights"
                />
                <SelectField
                  id="p-direction"
                  label="Direction"
                  required
                  value={form.direction}
                  onChange={set('direction')}
                  options={DIRECTION_OPTIONS}
                  error={fieldErrors.direction}
                />
              </div>

              <div className="form-grid">
                <SelectField
                  id="p-dest"
                  label="Linked destination"
                  value={form.destination_id}
                  onChange={set('destination_id')}
                  options={destOptions}
                  error={fieldErrors.destination_id}
                />
                <TextField
                  id="p-slug"
                  label="Slug"
                  hint="Leave blank to generate from the title."
                  value={form.slug}
                  onChange={set('slug')}
                  error={fieldErrors.slug}
                  maxLength={160}
                />
              </div>

              <div className="form-grid">
                <TextField
                  id="p-days"
                  label="Duration (days)"
                  type="number"
                  min={1}
                  max={365}
                  value={form.duration_days}
                  onChange={set('duration_days')}
                  error={fieldErrors.duration_days}
                />
                <TextField
                  id="p-price"
                  label="Price from"
                  type="number"
                  min={0}
                  step="any"
                  value={form.price_from}
                  onChange={set('price_from')}
                  error={fieldErrors.price_from}
                  hint="Leave blank if not applicable."
                />
              </div>

              <SelectField
                id="p-currency"
                label="Currency"
                value={form.currency}
                onChange={set('currency')}
                options={CURRENCY_OPTIONS}
                error={fieldErrors.currency}
              />

              <TextArea
                id="p-summary"
                label="Summary"
                hint="Shown on cards and in search results."
                value={form.summary}
                onChange={set('summary')}
                error={fieldErrors.summary}
                maxLength={500}
                rows={3}
              />

              <TextArea
                id="p-desc"
                label="Description"
                hint="Separate paragraphs with a blank line."
                value={form.description}
                onChange={set('description')}
                error={fieldErrors.description}
                rows={8}
              />

              <TextArea
                id="p-itin"
                label="Itinerary"
                hint={'One step per line, as:  Day | Title | Detail\nLeave the day blank to number automatically.'}
                value={form.itinerary}
                onChange={set('itinerary')}
                error={fieldErrors.itinerary}
                rows={8}
              />

              <div className="form-grid">
                <TextArea
                  id="p-inc"
                  label="Included"
                  hint="One per line."
                  value={form.includes}
                  onChange={set('includes')}
                  error={fieldErrors.includes}
                  rows={6}
                />
                <TextArea
                  id="p-exc"
                  label="Not included"
                  hint="One per line."
                  value={form.excludes}
                  onChange={set('excludes')}
                  error={fieldErrors.excludes}
                  rows={6}
                />
              </div>

              <ImagePicker id="p-image" label="Cover image" value={form.image_url} onChange={(v) => setForm((p) => ({ ...p, image_url: v }))} />

              <div className="row" style={{ gap: '1.6rem', marginBlock: '1.1rem' }}>
                <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.featured} onChange={set('featured')} />
                  <span>Featured</span>
                </label>
                <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.published} onChange={set('published')} />
                  <span>Published</span>
                </label>
              </div>

              <div className="row">
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create package'}
                </button>
                <button type="button" className="btn btn--outline" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="stack" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 74 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="card__body center" style={{ padding: '3rem 1rem' }}>
            <h3>No packages yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>Create the first tour package to populate the site.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--line)',
                  padding: '0.9rem clamp(14px, 2vw, 20px)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ width: 62, height: 46, borderRadius: 8, overflow: 'hidden', flex: 'none', background: 'var(--paper-warm)' }}>
                  {item.image_url ? (
                    <img src={mediaUrl(item.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>

                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <strong>{item.title}</strong>
                  <span className="muted" style={{ display: 'block', fontSize: '0.84rem' }}>
                    {item.direction.replace(/_/g, ' ')}
                    {item.duration_days ? ` · ${item.duration_days} days` : ''}
                    {item.price_from ? ` · from ${item.price_from} ${item.currency}` : ''}
                  </span>
                </div>

                <span className={`badge ${item.published ? 'badge--confirmed' : 'badge--archived'}`}>
                  {item.published ? 'live' : 'draft'}
                </span>
                {item.featured && <span className="badge badge--new">featured</span>}

                <div className="row" style={{ gap: '0.45rem', marginLeft: 'auto' }}>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(item)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
