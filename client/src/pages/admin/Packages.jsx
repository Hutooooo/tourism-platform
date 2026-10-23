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

const PRICING_STATUS_OPTIONS = [
  { value: 'indicative', label: 'Indicative estimate — confirmation required' },
  { value: 'supplier_verified', label: 'Supplier-verified price' },
  { value: 'unavailable', label: 'Temporarily unavailable' },
];

const PRICING_BASIS_OPTIONS = [
  { value: 'per_person', label: 'Per person' },
  { value: 'per_room', label: 'Per room' },
  { value: 'per_group', label: 'Per group' },
];

const ACCOMMODATION_OPTIONS = [
  { value: '', label: '— None —' },
  { value: 'budget', label: 'Budget' },
  { value: 'standard', label: 'Standard' },
  { value: 'superior', label: 'Superior' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'boutique', label: 'Boutique' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY = {
  title: '',
  direction: 'BOTH',
  destination_id: '',
  summary: '',
  description: '',
  duration_days: '',
  duration_nights: '',
  destinations_list: '',
  price_from: '',
  price_max: '',
  currency: 'EUR',
  pricing_status: 'indicative',
  pricing_basis: 'per_person',
  occupancy_note: '',
  accommodation: '',
  accommodation_category: '',
  itinerary: [],
  includes: '',
  excludes: '',
  add_ons: [],
  image_url: '',
  gallery: '',
  group_size_min: '',
  group_size_max: '',
  seasonal_notes: '',
  lead_time: '',
  cancellation_policy: '',
  disclaimer: '',
  seo_title: '',
  seo_description: '',
  featured: false,
  published: true,
  archived: false,
  slug: '',
};

const parseList = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

const cloneItinerary = (arr) =>
  (arr || []).map((s) => ({
    day: s.day ?? '',
    title: s.title || '',
    detail: s.detail || '',
    image: s.image || '',
  }));

const cloneAddOns = (arr) =>
  (arr || []).map((a) => ({
    name: a.name || '',
    price: a.price ?? '',
    currency: a.currency || 'USD',
    description: a.description || '',
  }));

function SectionTitle({ children }) {
  return (
    <h3
      style={{
        fontSize: '1rem',
        margin: '1.6rem 0 0.7rem',
        paddingBottom: '0.4rem',
        borderBottom: '1px solid var(--line)',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </h3>
  );
}

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
  const [statusFilter, setStatusFilter] = useState('all');

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
      duration_nights: item.duration_nights ?? '',
      destinations_list: (item.destinations_list || []).join('\n'),
      price_from: item.price_from ?? '',
      price_max: item.price_max ?? '',
      currency: item.currency || 'EUR',
      pricing_status: item.pricing_status || 'indicative',
      pricing_basis: item.pricing_basis || 'per_person',
      occupancy_note: item.occupancy_note || '',
      accommodation: item.accommodation || '',
      accommodation_category: item.accommodation_category || '',
      itinerary: cloneItinerary(item.itinerary),
      includes: (item.includes || []).join('\n'),
      excludes: (item.excludes || []).join('\n'),
      add_ons: cloneAddOns(item.add_ons),
      image_url: item.image_url || '',
      gallery: (item.gallery || []).join('\n'),
      group_size_min: item.group_size_min ?? '',
      group_size_max: item.group_size_max ?? '',
      seasonal_notes: item.seasonal_notes || '',
      lead_time: item.lead_time || '',
      cancellation_policy: item.cancellation_policy || '',
      disclaimer: item.disclaimer || '',
      seo_title: item.seo_title || '',
      seo_description: item.seo_description || '',
      featured: !!item.featured,
      published: !!item.published,
      archived: !!item.archived,
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
    if (form.duration_nights !== '' && Number(form.duration_nights) < 0) {
      errs.duration_nights = 'Cannot be negative.';
    }
    if (
      form.duration_nights !== '' &&
      form.duration_days !== '' &&
      Number(form.duration_nights) >= Number(form.duration_days)
    ) {
      errs.duration_nights = 'Nights must be fewer than days.';
    }
    if (form.price_from !== '' && Number(form.price_from) < 0) errs.price_from = 'Cannot be negative.';
    if (form.price_max !== '' && Number(form.price_max) < 0) errs.price_max = 'Cannot be negative.';
    if (
      form.price_from !== '' &&
      form.price_max !== '' &&
      Number(form.price_max) < Number(form.price_from)
    ) {
      errs.price_max = 'Maximum price must be greater than or equal to the minimum price.';
    }
    if (form.group_size_min !== '' && Number(form.group_size_min) < 1) errs.group_size_min = 'Must be at least 1.';
    if (form.group_size_max !== '' && Number(form.group_size_max) < 1) errs.group_size_max = 'Must be at least 1.';
    if (
      form.group_size_min !== '' &&
      form.group_size_max !== '' &&
      Number(form.group_size_max) < Number(form.group_size_min)
    ) {
      errs.group_size_max = 'Maximum group size must be at least the minimum.';
    }
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      errs.slug = 'Lowercase letters, numbers and hyphens only.';
    }
    if (form.add_ons.some((a) => !a.name.trim())) {
      errs.add_ons = 'Every add-on needs a name (or remove the row).';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload() {
    const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    return {
      title: form.title.trim(),
      direction: form.direction,
      destination_id: form.destination_id ? Number(form.destination_id) : null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      duration_days: numOrNull(form.duration_days),
      duration_nights: numOrNull(form.duration_nights),
      destinations_list: parseList(form.destinations_list),
      price_from: numOrNull(form.price_from),
      price_max: numOrNull(form.price_max),
      currency: form.currency,
      pricing_status: form.pricing_status,
      pricing_basis: form.pricing_basis,
      occupancy_note: form.occupancy_note.trim() || null,
      accommodation: form.accommodation.trim() || null,
      accommodation_category: form.accommodation_category || null,
      itinerary: form.itinerary
        .filter((d) => d.title.trim() || d.detail.trim())
        .map((d, i) => ({
          day: d.day === '' ? i + 1 : Number(d.day),
          title: d.title.trim(),
          detail: d.detail.trim(),
          ...(d.image.trim() ? { image: d.image.trim() } : {}),
        })),
      includes: parseList(form.includes),
      excludes: parseList(form.excludes),
      add_ons: form.add_ons
        .filter((a) => a.name.trim())
        .map((a) => ({
          name: a.name.trim(),
          ...(a.price !== '' && a.price !== null && a.price !== undefined ? { price: Number(a.price) } : {}),
          ...(a.currency ? { currency: a.currency } : {}),
          ...(a.description.trim() ? { description: a.description.trim() } : {}),
        })),
      image_url: form.image_url || null,
      gallery: parseList(form.gallery),
      group_size_min: numOrNull(form.group_size_min),
      group_size_max: numOrNull(form.group_size_max),
      seasonal_notes: form.seasonal_notes.trim() || null,
      lead_time: form.lead_time.trim() || null,
      cancellation_policy: form.cancellation_policy.trim() || null,
      disclaimer: form.disclaimer.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      featured: form.featured,
      published: form.published,
      archived: form.archived,
      ...(form.slug ? { slug: form.slug } : {}),
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    setNotice(null);
    if (!validate()) return;

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/packages/${editingId}`, buildPayload());
        setNotice({ type: 'success', text: 'Package updated.' });
      } else {
        await api.post('/packages', buildPayload());
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
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone. To hide it temporarily, archive it instead.`)) return;
    try {
      await api.del(`/packages/${item.id}`);
      setNotice({ type: 'success', text: 'Package deleted.' });
      if (editingId === item.id) resetForm();
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  async function patchStatus(item, changes, successText) {
    try {
      await api.patch(`/packages/${item.id}/status`, changes);
      setNotice({ type: 'success', text: successText });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  function togglePublished(item) {
    if (item.published) {
      if (!window.confirm(`Unpublish “${item.title}”? It will disappear from the public site.`)) return;
      patchStatus(item, { published: false }, 'Package unpublished.');
    } else {
      patchStatus(item, { published: true }, 'Package published.');
    }
  }

  function toggleArchived(item) {
    if (item.archived) {
      patchStatus(item, { archived: false }, 'Package restored.');
    } else {
      if (!window.confirm(`Archive “${item.title}”? It will disappear from the public site but keep its data.`)) return;
      patchStatus(item, { archived: true }, 'Package archived.');
    }
  }

  async function duplicate(item) {
    if (!window.confirm(`Duplicate “${item.title}” as a new draft?`)) return;
    try {
      const copy = await api.post(`/packages/${item.id}/duplicate`);
      setNotice({ type: 'success', text: `Duplicated as “${copy.title}”.` });
      await load();
      startEdit(copy);
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  async function move(item, delta) {
    // Swap with the adjacent row in the FULL sorted list so reordering stays
    // correct even when a status filter is active.
    const full = items;
    const index = full.findIndex((p) => p.id === item.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= full.length) return;
    const ids = full.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await api.post('/packages/reorder', { ids });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  function preview(item) {
    window.open(`/packages/${item.slug}?preview=1`, '_blank', 'noopener');
  }

  const setItineraryRow = (index, key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      itinerary: prev.itinerary.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  };

  const removeItineraryRow = (index) => () => {
    setForm((prev) => ({ ...prev, itinerary: prev.itinerary.filter((_, i) => i !== index) }));
  };

  const addItineraryRow = () => {
    setForm((prev) => ({
      ...prev,
      itinerary: [...prev.itinerary, { day: prev.itinerary.length + 1, title: '', detail: '', image: '' }],
    }));
  };

  const setAddOnRow = (index, key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      add_ons: prev.add_ons.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  };

  const removeAddOnRow = (index) => () => {
    setForm((prev) => ({ ...prev, add_ons: prev.add_ons.filter((_, i) => i !== index) }));
  };

  const addAddOnRow = () => {
    setForm((prev) => ({
      ...prev,
      add_ons: [...prev.add_ons, { name: '', price: '', currency: 'USD', description: '' }],
    }));
  };

  const destOptions = [{ value: '', label: '— None —' }, ...destinations.map((d) => ({ value: d.id, label: d.name }))];

  const visibleItems = items.filter((item) => {
    if (statusFilter === 'live') return item.published && !item.archived;
    if (statusFilter === 'draft') return !item.published && !item.archived;
    if (statusFilter === 'archived') return item.archived;
    return true;
  });

  const formatMeta = (item) => {
    const bits = [item.direction.replace(/_/g, ' ')];
    if (item.duration_days) {
      bits.push(`${item.duration_days}d${item.duration_nights != null ? ` / ${item.duration_nights}n` : ''}`);
    }
    if (item.price_from != null) {
      bits.push(
        item.price_max != null
          ? `${item.price_from}–${item.price_max} ${item.currency}`
          : `from ${item.price_from} ${item.currency}`
      );
    }
    const cities = item.destinations_list || [];
    if (cities.length) bits.push(cities.slice(0, 3).join(', '));
    return bits.join(' · ');
  };

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
              <SectionTitle>Basics</SectionTitle>
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
                  hint="Optional — connects this package to a destination page."
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

              <SectionTitle>Duration &amp; destinations</SectionTitle>
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
                  id="p-nights"
                  label="Duration (nights)"
                  type="number"
                  min={0}
                  max={365}
                  value={form.duration_nights}
                  onChange={set('duration_nights')}
                  error={fieldErrors.duration_nights}
                />
              </div>

              <TextArea
                id="p-cities"
                label="Destinations"
                hint="One city or place per line, e.g. Negombo / Sigiriya / Kandy. Shown as text on cards and the detail page."
                value={form.destinations_list}
                onChange={set('destinations_list')}
                error={fieldErrors.destinations_list}
                rows={4}
              />

              <SectionTitle>Pricing</SectionTitle>
              <div className="form-grid">
                <TextField
                  id="p-price"
                  label="Minimum price"
                  type="number"
                  min={0}
                  step="any"
                  value={form.price_from}
                  onChange={set('price_from')}
                  error={fieldErrors.price_from}
                  hint="Leave blank if not applicable."
                />
                <TextField
                  id="p-price-max"
                  label="Maximum price"
                  type="number"
                  min={0}
                  step="any"
                  value={form.price_max}
                  onChange={set('price_max')}
                  error={fieldErrors.price_max}
                  hint="Leave blank for a single price."
                />
              </div>

              <div className="form-grid">
                <SelectField
                  id="p-currency"
                  label="Currency"
                  value={form.currency}
                  onChange={set('currency')}
                  options={CURRENCY_OPTIONS}
                  error={fieldErrors.currency}
                />
                <SelectField
                  id="p-basis"
                  label="Pricing basis"
                  value={form.pricing_basis}
                  onChange={set('pricing_basis')}
                  options={PRICING_BASIS_OPTIONS}
                  error={fieldErrors.pricing_basis}
                />
              </div>

              <div className="form-grid">
                <TextField
                  id="p-occupancy"
                  label="Occupancy note"
                  hint="e.g. based on double occupancy."
                  value={form.occupancy_note}
                  onChange={set('occupancy_note')}
                  error={fieldErrors.occupancy_note}
                  maxLength={300}
                />
                <SelectField
                  id="p-pricing-status"
                  label="Pricing status"
                  value={form.pricing_status}
                  onChange={set('pricing_status')}
                  options={PRICING_STATUS_OPTIONS}
                  error={fieldErrors.pricing_status}
                />
              </div>

              <SectionTitle>Itinerary (day by day)</SectionTitle>
              {fieldErrors.itinerary && (
                <Alert type="error">{fieldErrors.itinerary}</Alert>
              )}
              {form.itinerary.length === 0 && (
                <p className="muted" style={{ fontSize: '0.9rem', margin: '0 0 0.6rem' }}>
                  No days yet — add the first day below.
                </p>
              )}
              {form.itinerary.map((row, i) => (
                <div
                  key={i}
                  className="card"
                  style={{ marginBottom: '0.7rem', background: 'var(--paper-warm)' }}
                >
                  <div className="card__body" style={{ padding: '0.8rem 1rem' }}>
                    <div className="row" style={{ gap: '0.6rem', alignItems: 'flex-end' }}>
                      <TextField
                        id={`p-itin-day-${i}`}
                        label="Day"
                        type="number"
                        min={1}
                        value={row.day}
                        onChange={setItineraryRow(i, 'day')}
                        style={{ width: 80 }}
                      />
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <TextField
                          id={`p-itin-title-${i}`}
                          label="Heading"
                          value={row.title}
                          onChange={setItineraryRow(i, 'title')}
                          maxLength={200}
                          placeholder="Arrive Rome"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={removeItineraryRow(i)}
                        aria-label={`Remove day ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                    <TextArea
                      id={`p-itin-detail-${i}`}
                      label="Description"
                      value={row.detail}
                      onChange={setItineraryRow(i, 'detail')}
                      rows={2}
                    />
                    <TextField
                      id={`p-itin-image-${i}`}
                      label="Image URL (optional)"
                      hint="Cover or inline image for this day. Upload via Media if you need hosting."
                      value={row.image}
                      onChange={setItineraryRow(i, 'image')}
                      maxLength={2000}
                    />
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn--outline btn--sm" onClick={addItineraryRow}>
                + Add day
              </button>

              <SectionTitle>Inclusions</SectionTitle>
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

              <SectionTitle>Optional add-ons</SectionTitle>
              {fieldErrors.add_ons && <Alert type="error">{fieldErrors.add_ons}</Alert>}
              {form.add_ons.map((row, i) => (
                <div key={i} className="row" style={{ gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 2, minWidth: 160 }}>
                    <TextField
                      id={`p-addon-name-${i}`}
                      label={i === 0 ? 'Add-on name' : undefined}
                      value={row.name}
                      onChange={setAddOnRow(i, 'name')}
                      maxLength={200}
                      placeholder="Private boat charter"
                    />
                  </div>
                  <div style={{ width: 110 }}>
                    <TextField
                      id={`p-addon-price-${i}`}
                      label={i === 0 ? 'Price' : undefined}
                      type="number"
                      min={0}
                      step="any"
                      value={row.price}
                      onChange={setAddOnRow(i, 'price')}
                    />
                  </div>
                  <div style={{ width: 100 }}>
                    <SelectField
                      id={`p-addon-currency-${i}`}
                      label={i === 0 ? 'Curr.' : undefined}
                      value={row.currency}
                      onChange={setAddOnRow(i, 'currency')}
                      options={CURRENCY_OPTIONS}
                    />
                  </div>
                  <div style={{ flex: 2, minWidth: 160 }}>
                    <TextField
                      id={`p-addon-desc-${i}`}
                      label={i === 0 ? 'Description' : undefined}
                      value={row.description}
                      onChange={setAddOnRow(i, 'description')}
                      maxLength={300}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={removeAddOnRow(i)}
                    aria-label={`Remove add-on ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn--outline btn--sm" onClick={addAddOnRow}>
                + Add add-on
              </button>

              <SectionTitle>Stay &amp; group</SectionTitle>
              <TextArea
                id="p-accom"
                label="Accommodation"
                hint="What guests can expect where they sleep."
                value={form.accommodation}
                onChange={set('accommodation')}
                error={fieldErrors.accommodation}
                rows={3}
              />
              <div className="form-grid">
                <SelectField
                  id="p-accom-cat"
                  label="Accommodation category"
                  value={form.accommodation_category}
                  onChange={set('accommodation_category')}
                  options={ACCOMMODATION_OPTIONS}
                  error={fieldErrors.accommodation_category}
                />
                <div />
              </div>
              <div className="form-grid">
                <TextField
                  id="p-group-min"
                  label="Minimum group size"
                  type="number"
                  min={1}
                  max={100}
                  value={form.group_size_min}
                  onChange={set('group_size_min')}
                  error={fieldErrors.group_size_min}
                />
                <TextField
                  id="p-group-max"
                  label="Maximum group size"
                  type="number"
                  min={1}
                  max={100}
                  value={form.group_size_max}
                  onChange={set('group_size_max')}
                  error={fieldErrors.group_size_max}
                />
              </div>

              <SectionTitle>Good to know &amp; terms</SectionTitle>
              <TextArea
                id="p-seasonal"
                label="Seasonal / date notes"
                hint="Best months, closures, weather caveats."
                value={form.seasonal_notes}
                onChange={set('seasonal_notes')}
                error={fieldErrors.seasonal_notes}
                rows={3}
              />
              <TextArea
                id="p-lead"
                label="Booking lead time"
                hint="How far ahead guests should book."
                value={form.lead_time}
                onChange={set('lead_time')}
                error={fieldErrors.lead_time}
                rows={2}
              />
              <TextArea
                id="p-cancel"
                label="Cancellation policy"
                value={form.cancellation_policy}
                onChange={set('cancellation_policy')}
                error={fieldErrors.cancellation_policy}
                rows={4}
              />

              <SectionTitle>Pricing disclaimer override</SectionTitle>
              <TextArea
                id="p-disclaimer"
                label="Custom disclaimer"
                hint="Leave blank to use the site-wide disclaimer from Settings."
                value={form.disclaimer}
                onChange={set('disclaimer')}
                error={fieldErrors.disclaimer}
                rows={4}
              />

              <SectionTitle>SEO</SectionTitle>
              <TextField
                id="p-seo-title"
                label="SEO title"
                hint="Leave blank to use the package title."
                value={form.seo_title}
                onChange={set('seo_title')}
                error={fieldErrors.seo_title}
                maxLength={160}
              />
              <TextArea
                id="p-seo-desc"
                label="SEO description"
                hint="Leave blank to use the summary."
                value={form.seo_description}
                onChange={set('seo_description')}
                error={fieldErrors.seo_description}
                maxLength={320}
                rows={2}
              />

              <SectionTitle>Media</SectionTitle>
              <ImagePicker
                id="p-image"
                label="Cover image"
                value={form.image_url}
                onChange={(v) => setForm((p) => ({ ...p, image_url: v }))}
              />
              <TextArea
                id="p-gallery"
                label="Gallery"
                hint="One image URL per line."
                value={form.gallery}
                onChange={set('gallery')}
                error={fieldErrors.gallery}
                rows={3}
              />

              <SectionTitle>Visibility</SectionTitle>
              <div className="row" style={{ gap: '1.6rem', marginBlock: '1.1rem', flexWrap: 'wrap' }}>
                <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.featured} onChange={set('featured')} />
                  <span>Featured</span>
                </label>
                <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.published} onChange={set('published')} />
                  <span>Published</span>
                </label>
                <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.archived} onChange={set('archived')} />
                  <span>Archived</span>
                </label>
              </div>

              <div className="row" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create package'}
                </button>
                {editingId && form.slug && (
                  <button type="button" className="btn btn--ghost" onClick={() => preview({ slug: form.slug })}>
                    Preview
                  </button>
                )}
                <button type="button" className="btn btn--outline" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && items.length > 0 && (
        <div className="row" style={{ gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }} role="group" aria-label="Filter packages by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`pill ${statusFilter === f.value ? 'pill--solid' : ''}`}
              aria-pressed={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="stack" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 74 }} />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="card">
          <div className="card__body center" style={{ padding: '3rem 1rem' }}>
            <h3>{statusFilter === 'all' ? 'No packages yet' : 'Nothing in this view'}</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              {statusFilter === 'all'
                ? 'Create the first tour package to populate the site.'
                : 'Try a different status filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visibleItems.map((item) => {
              const fullIndex = items.findIndex((p) => p.id === item.id);
              return (
                <li
                  key={item.id}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    padding: '0.9rem clamp(14px, 2vw, 20px)',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    opacity: item.archived ? 0.7 : 1,
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
                      {formatMeta(item)}
                    </span>
                  </div>

                  {item.archived ? (
                    <span className="badge badge--archived">archived</span>
                  ) : (
                    <span className={`badge ${item.published ? 'badge--confirmed' : 'badge--archived'}`}>
                      {item.published ? 'live' : 'draft'}
                    </span>
                  )}
                  {item.featured && <span className="badge badge--new">featured</span>}

                  <div className="row" style={{ gap: '0.45rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(item, -1)}
                      disabled={fullIndex === 0}
                      aria-label={`Move “${item.title}” up`}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(item, 1)}
                      disabled={fullIndex === items.length - 1}
                      aria-label={`Move “${item.title}” down`}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => preview(item)}>
                      Preview
                    </button>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => duplicate(item)}>
                      Duplicate
                    </button>
                    {!item.archived && (
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => togglePublished(item)}>
                        {item.published ? 'Unpublish' : 'Publish'}
                      </button>
                    )}
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => toggleArchived(item)}>
                      {item.archived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(item)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
