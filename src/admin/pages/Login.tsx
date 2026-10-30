import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AIcon from '../components/AIcon.tsx';
import AdminLogo from '../components/AdminLogo.tsx';
import Img from '../../components/ui/Img.tsx';
import { HOME_IMAGES } from '../../data/images.ts';
import { useAuth } from '../auth.tsx';
import { api, DEMO_LOGIN, USING_MOCK } from '../api/index.ts';
import { firebaseConfigured, missingFirebaseConfig } from '../../lib/firebase.ts';
import { useAdminTitle } from '../hooks.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Sprig({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 200" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M20 190C50 140 80 90 150 10" />
      {[30, 60, 90, 120].map((t, i) => (
        <g key={t} transform={`translate(${20 + t * 0.95} ${190 - t * 1.18}) rotate(${-40 + i * 4})`}>
          <path d="M0 0c-6-18 0-36 16-44 4 18-2 34-16 44z" />
          <path d="M0 0c4-14 9-28 16-44" opacity=".6" />
          <path d="M0 0c18-4 34 2 42 18-18 4-34-2-42-18z" />
        </g>
      ))}
    </svg>
  );
}

export default function Login() {
  useAdminTitle('Sign in');
  const { admin, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [reset, setReset] = useState({ busy: false, msg: '' });
  const notConnected = !USING_MOCK && !firebaseConfigured();
  const demo = DEMO_LOGIN;

  const sendReset = async () => {
    if (!EMAIL_RE.test(form.email.trim())) {
      setErrors({ email: 'Enter your email address first.' });
      return;
    }
    setReset({ busy: true, msg: '' });
    try {
      await api.auth.resetPassword(form.email.trim());
      setReset({ busy: false, msg: 'If this email belongs to the admin account, a password reset link is on its way. Check your inbox.' });
    } catch (err) {
      setReset({ busy: false, msg: (err instanceof Error && err.message) || 'Could not send the reset email. Please try again.' });
    }
  };

  if (admin) return <Navigate to={loc.state?.from || '/admin/dashboard'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: { email?: string; password?: string } = {};
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter your email address.';
    if (!form.password) errs.password = 'Enter your password.';
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login({ email: form.email.trim(), password: form.password, remember: form.remember });
      nav(loc.state?.from || '/admin/dashboard', { replace: true });
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Could not sign in. Please try again.');
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-login">
      <div className="ad-login-art">
        <Img src={HOME_IMAGES.about.src} alt="Eden Glow Studio salon interior with round mirrors and styling chairs" className="ad-login-img" priority />
        <div className="ad-login-art-text">
          <span className="ad-login-rule" aria-hidden="true" />
          <p className="ad-login-pillars">Beauty Services &nbsp;|&nbsp; Self-Care &nbsp;|&nbsp; Confidence</p>
          <p className="ad-login-quote">“A more beautiful you, Every day.”</p>
        </div>
      </div>

      <div className="ad-login-side">
        <Sprig className="ad-login-sprig ad-login-sprig--top" />
        <Sprig className="ad-login-sprig ad-login-sprig--bottom" />
        <div className="ad-login-brand">
          <AdminLogo />
          <span className="ad-login-panel">Admin Panel</span>
        </div>

        <form className="ad-login-card" onSubmit={submit} noValidate>
          <h1>Sign in to your account</h1>
          <p className="ad-login-lede">Manage appointments, billing, customers and more.</p>

          {notConnected && (
            <div className="ad-alert ad-alert--error" role="alert">
              <AIcon name="info" size={18} />
              <span>
                The admin is not connected to Firebase yet. Add <code>{missingFirebaseConfig().join(', ')}</code> to <code>.env.local</code> (see <code>.env.example</code>) and restart.
              </span>
            </div>
          )}

          {error && (
            <div className="ad-alert ad-alert--error" role="alert">
              <AIcon name="info" size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className={`ad-login-field ${errors.email ? 'has-error' : ''}`}>
            <label htmlFor="ad-email" className="visually-hidden">
              Email address
            </label>
            <span className="ad-login-ico">
              <AIcon name="mail" size={20} />
            </span>
            <input
              id="ad-email"
              type="email"
              autoComplete="username"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'ad-email-err' : undefined}
            />
          </div>
          {errors.email && (
            <span id="ad-email-err" className="ad-field-error">
              {errors.email}
            </span>
          )}

          <div className={`ad-login-field ${errors.password ? 'has-error' : ''}`}>
            <label htmlFor="ad-pass" className="visually-hidden">
              Password
            </label>
            <span className="ad-login-ico">
              <AIcon name="lock" size={20} />
            </span>
            <input
              id="ad-pass"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'ad-pass-err' : undefined}
            />
            <button type="button" className="ad-login-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
              <AIcon name={show ? 'eyeOff' : 'eye'} size={20} />
            </button>
          </div>
          {errors.password && (
            <span id="ad-pass-err" className="ad-field-error">
              {errors.password}
            </span>
          )}

          <div className="ad-login-row">
            <label className="ad-check">
              <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
              <span>Keep me signed in on this device</span>
            </label>
            <button type="button" className="ad-link" onClick={() => setForgot((f) => !f)} aria-expanded={forgot}>
              Forgot password?
            </button>
          </div>
          {forgot && (
            <div className="ad-login-help" role="status">
              {USING_MOCK ? (
                'Password reset is not available in demo mode.'
              ) : (
                <>
                  Enter the admin email above and we’ll send a link to choose a new password.{' '}
                  <button type="button" className="ad-link" onClick={sendReset} disabled={reset.busy}>
                    {reset.busy ? 'Sending…' : 'Send reset link'}
                  </button>
                  {reset.msg && <span className="ad-block ad-mt-s">{reset.msg}</span>}
                </>
              )}
            </div>
          )}

          <button type="submit" className="ad-btn ad-btn--primary ad-btn--block ad-login-submit" disabled={busy || notConnected}>
            {busy ? 'Signing in…' : 'Sign In'}
            {!busy && <AIcon name="arrow" size={18} />}
          </button>

          <div className="ad-or" aria-hidden="true">
            <span>OR</span>
          </div>

          <div className="ad-login-secure">
            <AIcon name="shield" size={30} stroke={1.3} />
            <span>
              <b>This is a secure admin area.</b>
              <small>Only authorised access is allowed.</small>
            </span>
          </div>

          {demo && (
            <div className="ad-login-demo">
              <b>Demo mode</b> — no server is connected yet, so this sign-in only checks sample credentials in your browser and does not protect real data.
              <span>
                Email <code>{demo.email}</code> · Password <code>{demo.password}</code>
              </span>
              <button type="button" className="ad-link" onClick={() => setForm({ ...form, email: demo.email, password: demo.password })}>
                Fill demo sign-in
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
