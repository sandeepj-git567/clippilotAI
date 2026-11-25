'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getGoogleAuthUrl, login, register } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(`Authentication error: ${errorParam}`);
    }
  }, [searchParams]);

  const handleGoogleAuth = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const res = await getGoogleAuthUrl();
      if (res.success && res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        setError(res.message || 'Failed to generate Google Sign-In URL');
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Google Sign-In failed');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await register({ email, password, name });
        if (res.token) {
          localStorage.setItem('auth_token', res.token);
          setSuccessMsg('Account created successfully! Redirecting...');
          setTimeout(() => {
            window.location.href = '/';
          }, 800);
        }
      } else {
        const res = await login({ email, password });
        if (res.token) {
          localStorage.setItem('auth_token', res.token);
          setSuccessMsg('Logged in successfully! Redirecting...');
          setTimeout(() => {
            window.location.href = '/';
          }, 800);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-3xl mb-3">
          🎯
        </div>
        <h1 className="text-2xl font-bold text-white">ClipPilot AI</h1>
        <p className="text-gray-400 text-sm mt-1">
          {isRegister ? 'Create your account to start automating Shorts' : 'Sign in to access your automation dashboard'}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-900/40 border border-red-700/60 text-red-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-green-900/40 border border-green-700/60 text-green-300 text-xs flex items-center gap-2">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        onClick={handleGoogleAuth}
        disabled={googleLoading || loading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-medium text-sm transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mb-6"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>{googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gray-800"></div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">or with email</span>
        <div className="flex-1 h-px bg-gray-800"></div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegister && (
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      {/* Toggle sign in / register */}
      <div className="mt-6 text-center text-xs text-gray-400">
        {isRegister ? (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className="text-blue-400 hover:underline font-semibold"
            >
              Sign In
            </button>
          </p>
        ) : (
          <p>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className="text-blue-400 hover:underline font-semibold"
            >
              Sign Up
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading sign-in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
