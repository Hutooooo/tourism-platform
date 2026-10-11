import { useState } from 'react';
import { api } from '../api/client';
import { TextField, TextArea, SelectField, Alert } from './FormField';

const DIRECTION_OPTIONS = [
  { value: 'SL_TO_IT', label: 'Sri Lanka → Italy' },
  { value: 'IT_TO_SL', label: 'Italy → Sri Lanka' },
  { value: 'BOTH', label: 'Both / not sure yet' },
];

const INITIAL = {
  name: '',
  email: '',
  phone: '',
  travel_date: '',
  adults: 1,
  children: 0,
  direction: '',
  notes: '',
};

/**
 * Public booking-request form. Submits to POST /api/bookings, which is
 * rate-limited server-side. On success the form is replaced by a
 * confirmation showing the reference number.
 */
export default function BookingForm({ packageSlug, direction: fixedDirection, travellersHint = 1 }) {
  const [values, setValues] = useState(() => ({
    ...INITIAL,
    direction: fixedDirection || '',
    adults: Math.max(1, travellersHint || 1),
  }));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const set = (key) => (e) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  /** Client-side checks mirroring the server rules, for instant feedback. */
  function validate() {
    const next = {};
    if (!values.name.trim() || values.name.trim().length < 2) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (values.phone.trim() && !/^\+?[0-9][0-9\s().-]{5,24}$/.test(values.phone.trim())) {
      next.phone = 'Enter a valid phone number, or leave it blank.';
    }
    if (values.travel_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.travel_date)) {
      next.travel_date = 'Use the format YYYY-MM-DD.';
    }
    if (Number(values.adults) < 1) next.adults = 'At least one adult.';
    if (Number(values.children) < 0) next.children = 'Cannot be negative.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() || undefined,
        travel_date: values.travel_date || undefined,
        adults: Number(values.adults),
        children: Number(values.children),
        travellers: Number(values.adults) + Number(values.children),
        notes: values.notes.trim() || undefined,
        direction: values.direction || fixedDirection || undefined,
        package_slug: packageSlug || undefined,
      };

      const data = await api.postPublic('/bookings', payload);
      setConfirmation(data);
    } catch (err) {
      // Surface field-level errors returned by the API.
      if (err.details && typeof err.details === 'object') {
        setErrors(err.details);
        const first = Object.values(err.details)[0];
        setSubmitError(first || err.message);
      } else {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <div className="alert alert--success" role="status">
        <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Request received — thank you.</strong>
        Your reference is <strong>{confirmation.reference}</strong>. We will reply to{' '}
        {values.email} with availability and next steps.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Alert type="error">{submitError}</Alert>

      <TextField
        id="bk-name"
        label="Full name"
        required
        autoComplete="name"
        value={values.name}
        onChange={set('name')}
        error={errors.name}
        maxLength={140}
      />

      <TextField
        id="bk-email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={values.email}
        onChange={set('email')}
        error={errors.email}
        maxLength={254}
      />

      <div className="form-grid">
        <TextField
          id="bk-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="+39 …"
          value={values.phone}
          onChange={set('phone')}
          error={errors.phone}
          maxLength={32}
        />

        <TextField
          id="bk-date"
          label="Approximate travel date"
          type="date"
          value={values.travel_date}
          onChange={set('travel_date')}
          error={errors.travel_date}
        />
      </div>

      <div className="form-grid">
        <TextField
          id="bk-adults"
          label="Adults"
          type="number"
          min={1}
          max={50}
          value={values.adults}
          onChange={set('adults')}
          error={errors.adults}
        />
        <TextField
          id="bk-children"
          label="Children"
          type="number"
          min={0}
          max={30}
          value={values.children}
          onChange={set('children')}
          error={errors.children}
        />
      </div>

      {!fixedDirection && (
        <SelectField
          id="bk-direction"
          label="Direction"
          value={values.direction}
          onChange={set('direction')}
          options={DIRECTION_OPTIONS}
          placeholder="Choose a direction"
          error={errors.direction}
        />
      )}

      <TextArea
        id="bk-notes"
        label="Anything we should know"
        hint="Interests, dietary needs, flexibility on dates…"
        value={values.notes}
        onChange={set('notes')}
        error={errors.notes}
        maxLength={3000}
      />

      <button type="submit" className="btn btn--block btn--lg" disabled={submitting}>
        {submitting ? (
          <>
            <span className="spin" aria-hidden="true" style={{ display: 'inline-block' }}>
              ⟳
            </span>
            Sending…
          </>
        ) : (
          'Send booking request'
        )}
      </button>

      <p className="field__hint" style={{ marginTop: '0.7rem' }}>
        This is a request, not a confirmed reservation. We will contact you before anything is booked.
      </p>
    </form>
  );
}
