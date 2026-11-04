import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getApiError } from '../../services/api';

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  useDocumentTitle('Create account');

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  }

  function validate() {
    const nextErrors = {};

    if (form.name.trim().length < 2) {
      nextErrors.name = 'Enter your full name (at least 2 characters).';
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (form.password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    } else if (
      !/[A-Za-z]/.test(form.password) ||
      !/[0-9]/.test(form.password)
    ) {
      nextErrors.password = 'Include at least one letter and one number.';
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const session = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      toast.success(
        'Account created',
        `Welcome to PayShield, ${session.user.name}. Your demo wallet is ready.`
      );
      navigate('/dashboard', { replace: true });
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
      title="Create your customer account"
      subtitle="Your account starts with a simulated wallet so you can explore the full payment and fraud-review flow."
      footer={
        <p className="text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-blue-600 transition hover:text-blue-700"
          >
            Sign in instead
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
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Asha Verma"
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
          error={errors.name}
          required
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(event) => updateField('password', event.target.value)}
          error={errors.password}
          hint="Use at least 8 characters with one letter and one number."
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

        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={form.confirmPassword}
          onChange={(event) =>
            updateField('confirmPassword', event.target.value)
          }
          error={errors.confirmPassword}
          required
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={submitting}
          icon={UserPlus}
        >
          {submitting ? 'Creating your wallet…' : 'Create account'}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          This is a portfolio simulation. No real banking details or money are
          involved.
        </p>
      </form>
    </AuthShell>
  );
}
