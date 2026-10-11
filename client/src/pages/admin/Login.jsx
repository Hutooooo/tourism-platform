import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { TextField, Alert } from '../../components/FormField';

export default function Login() {
  const { login, isAuthenticated, booting } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state && location.state.from) || '/admin';

  // Already signed in → skip the form entirely.
  if (!booting && isAuthenticated) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs = {};
    if (!email.trim()) errs.email = 'Enter your email address.';
    if (!password) errs.password = 'Enter your password.';
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.details && typeof err.details === 'object') setFieldErrors(err.details);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '3rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div className="card">
          <div className="card__body" style={{ padding: 'clamp(26px, 4vw, 38px)' }}>
            <div className="eyebrow">Administration</div>
            <h1 style={{ fontSize: '1.7rem', marginBottom: '0.4rem' }}>Sign in</h1>
            <p className="muted" style={{ marginBottom: '1.6rem', fontSize: '0.93rem' }}>
              Manage content for {settings.brand_name}.
            </p>

            <Alert type="error">{error}</Alert>

            <form onSubmit={onSubmit} noValidate>
              <TextField
                id="login-email"
                label="Email"
                type="email"
                required
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
              />
              <TextField
                id="login-password"
                label="Password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />
              <button type="submit" className="btn btn--block btn--lg" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="field__hint" style={{ marginTop: '1.2rem' }}>
              Lost access? Change the administrator&apos;s password from a working session, or delete
              the user row and re-run <code>npm run seed</code> with a new <code>ADMIN_PASSWORD</code>.
            </p>
          </div>
        </div>

        <div className="center" style={{ marginTop: '1.2rem' }}>
          <Link to="/" className="muted" style={{ fontSize: '0.9rem' }}>
            ← Back to the website
          </Link>
        </div>
      </div>
    </div>
  );
}
