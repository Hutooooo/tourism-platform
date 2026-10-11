import { useState } from 'react';
import { api } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import ContactTiles from '../components/ContactTiles';
import { TextField, TextArea, SelectField, Alert } from '../components/FormField';

const TYPE_OPTIONS = [
  { value: 'general', label: 'General question' },
  { value: 'custom-tour', label: 'Custom tour request' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Something else' },
];

const INITIAL = { name: '', email: '', phone: '', subject: '', type: 'general', message: '' };

export default function Contact() {
  const { settings, contact } = useSettings();
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  // Kept separately: the form is cleared on success, so the confirmation
  // would otherwise have no address to echo back.
  const [sentTo, setSentTo] = useState('');

  useSeo({
    title: 'Contact',
    description: `Contact ${settings.brand_name} by email, telephone or WhatsApp.`,
  });

  const set = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  function validate() {
    const next = {};
    if (!values.name.trim() || values.name.trim().length < 2) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (values.message.trim().length < 10) next.message = 'Please write at least 10 characters.';
    if (values.phone.trim() && !/^\+?[0-9][0-9\s().-]{5,24}$/.test(values.phone.trim())) {
      next.phone = 'Enter a valid phone number, or leave it blank.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const email = values.email.trim().toLowerCase();
      await api.postPublic('/inquiries', {
        name: values.name.trim(),
        email,
        phone: values.phone.trim() || undefined,
        subject: values.subject.trim() || undefined,
        message: values.message.trim(),
        type: values.type || 'general',
      });
      setSentTo(email);
      setSent(true);
      setValues(INITIAL);
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors(err.details);
        setSubmitError(Object.values(err.details)[0] || err.message);
      } else {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          <Reveal>
            <div className="eyebrow">Contact</div>
            <h1>Talk to us</h1>
            <p className="lead" style={{ marginTop: '0.9rem' }}>
              Email, telephone or WhatsApp — whichever suits you. We handle enquiries personally and
              reply as quickly as we can.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <ContactTiles />
          </Reveal>

          <div className="split" style={{ marginTop: 'clamp(36px, 5vw, 60px)', alignItems: 'start' }}>
            <Reveal variant="left">
              <div>
                <div className="eyebrow">Send a message</div>
                <h2 style={{ marginBottom: '1rem' }}>Write to us</h2>

                {sent ? (
                  <div className="alert alert--success" role="status">
                    <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Message sent.</strong>
                    Thank you — we have your enquiry and will reply to {sentTo} shortly.
                  </div>
                ) : (
                  <form onSubmit={onSubmit} noValidate>
                    <Alert type="error">{submitError}</Alert>

                    <div className="form-grid">
                      <TextField
                        id="ct-name"
                        label="Your name"
                        required
                        autoComplete="name"
                        value={values.name}
                        onChange={set('name')}
                        error={errors.name}
                        maxLength={140}
                      />
                      <TextField
                        id="ct-email"
                        label="Email"
                        type="email"
                        required
                        autoComplete="email"
                        value={values.email}
                        onChange={set('email')}
                        error={errors.email}
                        maxLength={254}
                      />
                    </div>

                    <div className="form-grid">
                      <TextField
                        id="ct-phone"
                        label="Phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+39 …"
                        value={values.phone}
                        onChange={set('phone')}
                        error={errors.phone}
                        maxLength={32}
                      />
                      <SelectField
                        id="ct-type"
                        label="What is this about?"
                        value={values.type}
                        onChange={set('type')}
                        options={TYPE_OPTIONS}
                        error={errors.type}
                      />
                    </div>

                    <TextField
                      id="ct-subject"
                      label="Subject"
                      value={values.subject}
                      onChange={set('subject')}
                      error={errors.subject}
                      maxLength={200}
                    />

                    <TextArea
                      id="ct-message"
                      label="Message"
                      required
                      value={values.message}
                      onChange={set('message')}
                      error={errors.message}
                      maxLength={5000}
                      rows={7}
                    />

                    <button type="submit" className="btn btn--lg btn--block" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send message'}
                    </button>
                  </form>
                )}
              </div>
            </Reveal>

            <Reveal variant="right">
              <div className="card">
                <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 32px)' }}>
                  <h3 style={{ marginBottom: '0.7rem' }}>What to include</h3>
                  <p className="muted" style={{ marginBottom: '1rem' }}>
                    The more you tell us, the more useful our first reply will be.
                  </p>
                  <ul className="feature-list">
                    <li>Which direction you are travelling — Sri Lanka to Italy, or Italy to Sri Lanka</li>
                    <li>Your approximate dates, or how flexible they are</li>
                    <li>How many people are travelling</li>
                    <li>Places you already know you want to see</li>
                    <li>Anything that matters: budget, pace, accessibility, dietary needs</li>
                  </ul>

                  <hr className="divider" style={{ marginBlock: '1.5rem' }} />

                  <h4 style={{ marginBottom: '0.6rem' }}>Prefer a quick chat?</h4>
                  <div className="row">
                    {contact.phone.href && (
                      <a className="btn btn--outline btn--sm" href={contact.phone.href}>
                        Call us
                      </a>
                    )}
                    {contact.whatsapp.href && (
                      <a
                        className="btn btn--outline btn--sm"
                        href={contact.whatsapp.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                    {contact.email.href && (
                      <a className="btn btn--outline btn--sm" href={contact.email.href}>
                        Email us
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
