import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '@/lib/firebase';

const PENDING_ORGANIZATION_NAME_KEY = 'sparqplug.pendingOrganizationName';

function getRegisterErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email address.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/network-request-failed':
      return 'Network error while creating your account. Check your connection and try again.';
    default:
      return error instanceof Error ? error.message : 'Registration failed.';
  }
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedOrgName = orgName.trim();

    if (!trimmedName || !trimmedEmail || !trimmedOrgName || !password) {
      setError('Full name, organization name, email, and password are required.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      window.localStorage.setItem(PENDING_ORGANIZATION_NAME_KEY, trimmedOrgName);
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(credential.user, { displayName: trimmedName });
      navigate('/dashboard');
    } catch (err: unknown) {
      window.localStorage.removeItem(PENDING_ORGANIZATION_NAME_KEY);
      setError(getRegisterErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
      <p className="text-muted-foreground text-sm mb-8">Start your SparQPlug journey</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="register-name" className="text-sm font-medium text-foreground">Full name</label>
          <input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={inputClass} placeholder="Jane Smith" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="register-organization" className="text-sm font-medium text-foreground">Organization name</label>
          <input id="register-organization" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required autoComplete="organization" className={inputClass} placeholder="Acme Inc." />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="register-email" className="text-sm font-medium text-foreground">Work email</label>
          <input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} placeholder="you@company.com" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="register-password" className="text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <input id="register-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} className={`${inputClass} pr-10`} placeholder="Min. 8 characters" />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}