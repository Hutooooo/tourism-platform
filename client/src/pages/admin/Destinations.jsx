import { useCallback, useEffect, useState } from 'react';
import { api, mediaUrl } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';
import { TextField, TextArea, SelectField, Alert } from '../../components/FormField';
import ImagePicker from '../../components/ImagePicker';

const COUNTRY_OPTIONS = [
  { value: 'Sri Lanka', label: 'Sri Lanka' },
  { value: 'Italy', label: 'Italy' },
];

const EMPTY = {
  name: '',
  country: 'Sri Lanka',
  region: '',
  summary: '',
  description: '',
  image_url: '',
  highlights: '',
  featured: false,
  published: true,
  slug: '',
};

/** Highlights are stored as a JSON array but edited as one-per-line text. */
const parseList = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export default function DestinationsAdmin() {
  useSeo({ title: 'Destinations — Dashboard' });

  const [items, setItems] = useState([]);
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
      const data = await api.get('/destinations?all=1');
      setItems(data);
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
      name: item.name || '',
      country: item.country || 'Sri Lanka',
      region: item.region || '',
      summary: item.summary || '',
      description: item.description || '',
      image_url: item.image_url || '',
      highlights: (item.highlights || []).join('\n'),
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
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name is required.';
    if (!form.country) errs.country = 'Choose a country.';
    if (form.summary.length > 400) errs.summary = 'Keep the summary under 400 characters.';
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
      name: form.name.trim(),
      country: form.country,
      region: form.region.trim() || null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      image_url: form.image_url || null,
      highlights: parseList(form.highlights),
      featured: form.featured,
      published: form.published,
      ...(form.slug ? { slug: form.slug } : {}),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/destinations/${editingId}`, payload);
        setNotice({ type: 'success', text: 'Destination updated.' });
      } else {
        await api.post('/destinations', payload);
        setNotice({ type: 'success', text: 'Destination created.' });
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
    if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
    try {
      await api.del(`/destinations/${item.id}`);
      setNotice({ type: 'success', text: 'Destination deleted.' });
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  async function togglePublished(item) {
    try {
      await api.put(`/destinations/${item.id}`, {
        name: item.name,
        country: item.country,
        region: item.region,
        summary: item.summary,
        description: item.description,
        image_url: item.image_url,
        highlights: item.highlights,
        featured: item.featured,
        published: !item.published,
        slug: item.slug,
        sort_order: item.sort_order,
      });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Content</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Destinations</h1>
        </div>
        <button type="button" className="btn" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Close form' : '+ New destination'}
        </button>
      </div>

      <Alert type="error">{error}</Alert>
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      {showForm && (
        <div className="card" style={{ marginBottom: 'clamp(24px, 3vw, 36px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1.1rem' }}>
              {editingId ? 'Edit destination' : 'New destination'}
            </h2>

            <form onSubmit={onSubmit} noValidate>
              <div className="form-grid">
                <TextField
                  id="d-name"
                  label="Name"
                  required
                  value={form.name}
                  onChange={set('name')}
                  error={fieldErrors.name}
                  maxLength={140}
                  placeholder="Sigiriya & Cultural Triangle"
                />
                <SelectField
                  id="d-country"
                  label="Country"
                  required
                  value={form.country}
                  onChange={set('country')}
                  options={COUNTRY_OPTIONS}
                  error={fieldErrors.country}
                />
              </div>

              <div className="form-grid">
                <TextField
                  id="d-region"
                  label="Region"
                  value={form.region}
                  onChange={set('region')}
                  error={fieldErrors.region}
                  maxLength={140}
                  placeholder="Central Province"
                />
                <TextField
                  id="d-slug"
                  label="Slug"
                  hint="Leave blank to generate from the name."
                  value={form.slug}
                  onChange={set('slug')}
                  error={fieldErrors.slug}
                  maxLength={120}
                  placeholder="sigiriya-and-cultural-triangle"
                />
              </div>

              <TextArea
                id="d-summary"
                label="Summary"
                hint="One or two sentences. Shown on cards and in search results."
                value={form.summary}
                onChange={set('summary')}
                error={fieldErrors.summary}
                maxLength={400}
                rows={3}
              />

              <TextArea
                id="d-desc"
                label="Description"
                hint="Separate paragraphs with a blank line."
                value={form.description}
                onChange={set('description')}
                error={fieldErrors.description}
                rows={8}
              />

              <TextArea
                id="d-highlights"
                label="Highlights"
                hint="One per line."
                value={form.highlights}
                onChange={set('highlights')}
                error={fieldErrors.highlights}
                rows={5}
              />

              <ImagePicker
                id="d-image"
                label="Cover image"
                value={form.image_url}
                onChange={(v) => setForm((p) => ({ ...p, image_url: v }))}
              />

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
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create destination'}
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
            <h3>No destinations yet</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Create the first one to populate the public site.
            </p>
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
                <div
                  style={{
                    width: 62,
                    height: 46,
                    borderRadius: 8,
                    overflow: 'hidden',
                    flex: 'none',
                    background: 'var(--paper-warm)',
                  }}
                >
                  {item.image_url ? (
                    <img
                      src={mediaUrl(item.image_url)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>

                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <strong>{item.name}</strong>
                  <span className="muted" style={{ display: 'block', fontSize: '0.84rem' }}>
                    {item.country}
                    {item.region ? ` · ${item.region}` : ''}
                  </span>
                </div>

                <span className={`badge ${item.published ? 'badge--confirmed' : 'badge--archived'}`}>
                  {item.published ? 'live' : 'draft'}
                </span>
                {item.featured && <span className="badge badge--new">featured</span>}

                <div className="row" style={{ gap: '0.45rem', marginLeft: 'auto' }}>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => togglePublished(item)}>
                    {item.published ? 'Unpublish' : 'Publish'}
                  </button>
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
