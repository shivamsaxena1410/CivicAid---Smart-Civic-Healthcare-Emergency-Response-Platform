'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { ErrorNote, Field } from '../../components/ui';
import { DemoCredentials } from '../../components/DemoCredentials';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, isLoading, error, clearError, user, isInitialized } = useAuthStore();

  // Both fields start empty. Pre-filling them made the first screen of the
  // product look like a test fixture; the seeded accounts are now one click
  // away in the corner instead.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const expired = params.get('expired') === '1';

  // Someone already signed in has no business on the login screen.
  useEffect(() => {
    if (isInitialized && user) router.replace('/dashboard');
  }, [isInitialized, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch {
      // The store already holds the message; nothing further to do here.
    }
  };

  return (
    <div
      className="page-shell cc-auth-page cc-login-page"
      style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', paddingTop: '3rem' }}
    >
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
          Civic<span style={{ color: 'var(--accent-cyan)' }}>Connect</span>
        </h1>
        <p className="muted" style={{ marginTop: '0.5rem', maxWidth: 460 }}>
          Civic health and emergency assistance: find nearby hospitals with beds free, blood banks with stock,
          pharmacies holding a medicine, and ambulances — plus complaints and government health schemes.
        </p>

        <div className="demo-banner" style={{ marginTop: '1.25rem' }}>
          <span aria-hidden>⚠</span>
          <span>
            <strong>Academic demonstration.</strong> Every organisation in this database is fictional and its
            availability figures are simulated. Nothing here reflects a real institution.
          </span>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.75rem', alignSelf: 'start' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 650, marginBottom: '1rem' }}>Sign in</h2>

        {expired ? (
          <div className="form-notice" style={{ marginBottom: '1rem' }}>
            Your session expired. Please sign in again.
          </div>
        ) : null}

        <ErrorNote error={error ? new Error(error) : null} />

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <Field label="Email">
            <input
              className="input-control"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              className="input-control"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className="btn-primary" type="submit" disabled={isLoading} style={{ justifyContent: 'center' }}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="subtle" style={{ marginTop: '1rem' }}>
          No account? <Link href="/register" style={{ color: 'var(--accent-cyan)' }}>Register as a citizen</Link>.
        </p>
      </div>

      {/* Fixed to the viewport, so it sits outside the grid flow despite being
          a child here. Picking an account fills the form above. */}
      <DemoCredentials
        onSelect={({ email: demoEmail, password: demoPassword }) => {
          clearError();
          setEmail(demoEmail);
          setPassword(demoPassword);
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  // `useSearchParams` needs a Suspense boundary; without it the whole route is
  // forced to dynamic rendering at build time.
  return (
    <Suspense fallback={<div className="page-shell"><div className="skeleton" style={{ height: 200 }} /></div>}>
      <LoginForm />
    </Suspense>
  );
}
