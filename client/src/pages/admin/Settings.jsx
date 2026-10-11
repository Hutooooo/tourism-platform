import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSeo } from '../../hooks/useSeo';
import { useSettings } from '../../context/SettingsContext';
import { TextField, TextArea, SelectField, Alert } from '../../components/FormField';

const DIRECTION_CHOICES = [
  { value: 'SL_TO_IT', label: 'Sri Lanka → Italy' },
  { value: 'IT_TO_SL', label: 'Italy → Sri Lanka' },
];

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'LKR', label: 'LKR' },
];

const EMPTY = {
  brand_name: '',
  tagline: '',
  contact_email: '',
  contact_phone: '',
  contact_whatsapp: '',
  directions: ['SL_TO_IT', 'IT_TO_SL'],
  hero_title: '',
  hero_subtitle: '',
  about_title: '',
  about_body: '',
  seo_title_suffix: '',
  seo_description: '',
  seo_keywords: '',
  currency: 'EUR',
  booking_enabled: true,
  inquiry_enabled: true,
  footer_note: '',
};

function toForm(settings) {
  const seo = settings.seo || {};
  return {
    brand_name: settings.brand_name ?? '',
    tagline: settings.tagline ?? '',
    contact_email: settings.contact_email ?? '',
    contact_phone: settings.contact_phone ?? '',
    contact_whatsapp: settings.contact_whatsapp ?? '',
    directions: Array.isArray(settings.directions) ? settings.directions : ['SL_TO_IT', 'IT_TO_SL'],
    hero_title: settings.hero_title ?? '',
    hero_subtitle: settings.hero_subtitle ?? '',
    about_title: settings.about_title ?? '',
    about_body: settings.about_body ?? '',
    seo_title_suffix: seo.title_suffix ?? '',
    seo_description: seo.description ?? '',
    seo_keywords: (seo.keywords || []).join(', '),
    currency: settings.currency ?? 'EUR',
    booking_enabled: settings.booking_enabled !== false,
    inquiry_enabled: settings.inquiry_enabled !== false,
    footer_note: settings.footer_note ?? '',
  };
}

function toPayload(form) {
  return {
    brand_name: form.brand_name,
    tagline: form.tagline,
    contact_email: form.contact_email,
    contact_phone: form.contact_phone,
    contact_whatsapp: form.contact_whatsapp,
    directions: form.directions,
    hero_title: form.hero_title,
    hero_subtitle: form.hero_subtitle,
    about_title: form.about_title,
    about_body: form.about_body,
    seo: {
      title_suffix: form.seo_title_suffix,
      description: form.seo_description,
      keywords: form.seo_keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    currency: form.currency,
    booking_enabled: form.booking_enabled,
    inquiry_enabled: form.inquiry_enabled,
    footer_note: form.footer_note,
  };
}

export default function SettingsPage() {
  useSeo({ title: 'Settings — Dashboard' });
  const { refresh } = useSettings();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/settings/all');
        if (!cancelled) setForm(toForm(data));
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

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  function toggleDirection(value) {
    setForm((prev) => {
      const has = prev.directions.includes(value);
      const next = has ? prev.directions.filter((d) => d !== value) : [...prev.directions, value];
      return { ...prev, directions: next };
    });
    setFieldErrors((prev) => (prev.directions ? { ...prev, directions: undefined } : prev));
  }

  function validate() {
    const errs = {};
    if (form.brand_name.trim().length < 2) errs.brand_name = 'Brand name must be at least 2 characters.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      errs.contact_email = 'Enter a valid email address.';
    }
    if (form.contact_phone && form.contact_phone.trim().length < 6) {
      errs.contact_phone = 'Enter a valid phone number.';
    }
    if (form.contact_whatsapp && form.contact_whatsapp.trim().length < 6) {
      errs.contact_whatsapp = 'Enter a valid WhatsApp number.';
    }
    if (form.directions.length === 0) errs.directions = 'Choose at least one direction.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setNotice(null);
    if (!validate()) return;

    setSaving(true);
    try {
      await api.put('/settings', toPayload(form));
      setNotice({ type: 'success', text: 'Settings saved. The public site now uses these values.' });
      await refresh();
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        const mapped = { ...err.details };
        // The API reports the nested SEO object as one key; surface it on
        // the individual field when it is just a generic type error.
        if (mapped.seo && !mapped.seo_title_suffix) mapped.seo_title_suffix = mapped.seo;
        setFieldErrors(mapped);
      }
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="stack" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 92 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Configuration</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem)' }}>Settings</h1>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <section className="card" style={{ marginBottom: 'clamp(20px, 2.5vw, 30px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>Brand</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Used in the header, footer and page titles. No official business name has been supplied
              yet — set it here once the owner confirms one.
            </p>

            <div className="form-grid">
              <TextField
                id="s-brand"
                label="Brand name"
                required
                value={form.brand_name}
                onChange={set('brand_name')}
                error={fieldErrors.brand_name}
                maxLength={120}
              />
              <TextField
                id="s-tagline"
                label="Tagline"
                value={form.tagline}
                onChange={set('tagline')}
                error={fieldErrors.tagline}
                maxLength={200}
              />
            </div>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 'clamp(20px, 2.5vw, 30px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>Contact details</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Shown on the Contact page, the footer and every reply action in the dashboard.
              Links are generated automatically (mailto, tel, WhatsApp).
            </p>

            <TextField
              id="s-email"
              label="Email address"
              type="email"
              value={form.contact_email}
              onChange={set('contact_email')}
              error={fieldErrors.contact_email}
              hint="Rendered as a mailto: link."
              maxLength={200}
            />

            <div className="form-grid">
              <TextField
                id="s-phone"
                label="Telephone"
                type="tel"
                value={form.contact_phone}
                onChange={set('contact_phone')}
                error={fieldErrors.contact_phone}
                hint="Rendered as a tel: link."
                maxLength={60}
              />
              <TextField
                id="s-wa"
                label="WhatsApp number"
                type="tel"
                value={form.contact_whatsapp}
                onChange={set('contact_whatsapp')}
                error={fieldErrors.contact_whatsapp}
                hint="Rendered as https://wa.me/<number>."
                maxLength={60}
              />
            </div>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 'clamp(20px, 2.5vw, 30px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Directions offered</h2>

            <div className="row" style={{ gap: '1.6rem', marginBottom: '0.4rem' }}>
              {DIRECTION_CHOICES.map((d) => (
                <label key={d.value} className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.directions.includes(d.value)}
                    onChange={() => toggleDirection(d.value)}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
            {fieldErrors.directions && (
              <span className="field__error" role="alert">
                {fieldErrors.directions}
              </span>
            )}
          </div>
        </section>

        <section className="card" style={{ marginBottom: 'clamp(20px, 2.5vw, 30px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.1rem' }}>Site copy</h2>

            <TextField
              id="s-hero-title"
              label="Hero title"
              value={form.hero_title}
              onChange={set('hero_title')}
              error={fieldErrors.hero_title}
              maxLength={160}
            />
            <TextArea
              id="s-hero-sub"
              label="Hero subtitle"
              value={form.hero_subtitle}
              onChange={set('hero_subtitle')}
              error={fieldErrors.hero_subtitle}
              maxLength={400}
              rows={3}
            />
            <TextField
              id="s-about-title"
              label="About title"
              value={form.about_title}
              onChange={set('about_title')}
              error={fieldErrors.about_title}
              maxLength={160}
            />
            <TextArea
              id="s-about-body"
              label="About body"
              value={form.about_body}
              onChange={set('about_body')}
              error={fieldErrors.about_body}
              rows={6}
            />
            <TextArea
              id="s-footer"
              label="Footer note"
              value={form.footer_note}
              onChange={set('footer_note')}
              error={fieldErrors.footer_note}
              maxLength={300}
              rows={2}
            />
          </div>
        </section>

        <section className="card" style={{ marginBottom: 'clamp(20px, 2.5vw, 30px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>Search &amp; SEO</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Applied to the document title and meta description of public pages.
            </p>

            <TextField
              id="s-seo-suffix"
              label="Title suffix"
              value={form.seo_title_suffix}
              onChange={set('seo_title_suffix')}
              error={fieldErrors.seo_title_suffix}
              maxLength={120}
              hint="Appended after each page title with a middle dot."
            />
            <TextArea
              id="s-seo-desc"
              label="Meta description"
              value={form.seo_description}
              onChange={set('seo_description')}
              error={fieldErrors.seo_description}
              maxLength={320}
              rows={3}
              hint="Aim for 140–160 characters."
            />
            <TextField
              id="s-seo-keys"
              label="Keywords"
              value={form.seo_keywords}
              onChange={set('seo_keywords')}
              error={fieldErrors.seo_keywords}
              hint="Comma separated."
              maxLength={400}
            />
          </div>
        </section>

        <section className="card" style={{ marginBottom: 'clamp(20px, 2.5vw, 30px)' }}>
          <div className="card__body" style={{ padding: 'clamp(20px, 3vw, 30px)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.1rem' }}>Operations</h2>

            <div className="form-grid">
              <SelectField
                id="s-currency"
                label="Display currency"
                value={form.currency}
                onChange={set('currency')}
                options={CURRENCY_OPTIONS}
                error={fieldErrors.currency}
              />
              <div />
            </div>

            <div className="row" style={{ gap: '1.8rem', marginTop: '0.4rem' }}>
              <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.booking_enabled}
                  onChange={set('booking_enabled')}
                />
                <span>Accept booking requests</span>
              </label>
              <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.inquiry_enabled}
                  onChange={set('inquiry_enabled')}
                />
                <span>Accept inquiries</span>
              </label>
            </div>
          </div>
        </section>

        <div className="row" style={{ marginBottom: '2rem' }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
