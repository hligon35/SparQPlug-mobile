import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';

function getLoginErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Network error while signing in. Check your connection and try again.';
    default:
      return error instanceof Error ? error.message : 'Sign-in failed.';
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, navigate, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm backdrop-blur sm:p-6">
      <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
      <p className="text-muted-foreground text-sm mb-8">Sign in to your SparQPlug account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 pr-10 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="••••••••"
            />
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
          disabled={loading || isLoading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading || isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/auth/register" className="text-primary hover:underline font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}
