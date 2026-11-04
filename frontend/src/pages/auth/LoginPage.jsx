import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getApiError } from '../../services/api';

const DEMO_ACCOUNTS = [
  {
    label: 'Asha Verma',
    email: 'asha@example.com',
    password: 'Customer@123',
    role: 'Customer',
  },
  {
    label: 'Ravi Kumar',
    email: 'ravi@example.com',
    password: 'Customer@123',
    role: 'Customer',
  },
  {
    label: 'PayShield Admin',
    email: 'admin@payshield.dev',
    password: 'Admin@12345',
    role: 'Admin',
  },
];

export default function LoginPage() {
  useDocumentTitle('Sign in');

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    if (!form.email.trim()) nextErrors.email = 'Enter your email address.';
    if (!form.password) nextErrors.password = 'Enter your password.';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const session = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      toast.success('Welcome back', `Signed in as ${session.user.name}.`);

      const fallback = session.user.role === 'admin' ? '/admin' : '/dashboard';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      const fieldErrors = {};

      for (const detail of apiError.details) {
        if (detail.field) fieldErrors[detail.field] = detail.message;
      }

      setErrors(fieldErrors);
      setFormError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign in to PayShield"
      subtitle="Access your simulated wallet, transfer money and review payments as an administrator."
      footer={
        <p className="text-sm text-slate-500">
          New to PayShield?{' '}
          <Link
            to="/register"
            className="font-semibold text-blue-600 transition hover:text-blue-700"
          >
            Create a customer account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {formError}
          </div>
        ) : null}

        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(event) => updateField('email', event.target.value)}
          error={errors.email}
          required
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(event) => updateField('password', event.target.value)}
          error={errors.password}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={submitting}
          icon={LogIn}
        >
          {submitting ? 'Verifying credentials…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Development demo accounts
          </p>
          <Badge tone="neutral">Seed data</Badge>
        </div>

        <div className="mt-3 space-y-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setForm({
                  email: account.email,
                  password: account.password,
                });
                setErrors({});
                setFormError('');
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-800">
                  {account.label} · {account.role}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {account.email}
                </span>
              </span>
              <span className="text-[11px] font-semibold text-blue-600">
                Use
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          These accounts exist only after running{' '}
          <code className="rounded bg-slate-200/70 px-1 py-0.5 text-[10px] text-slate-600">
            npm run seed
          </code>{' '}
          in the backend folder.
        </p>
      </div>
    </AuthShell>
  );
}
