'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { ErrorNote, Field } from '../../components/ui';

/**
 * Seeded demo accounts.
 *
 * These are real rows in the development database (backend/prisma/seed.ts) and
 * authenticate against the real API — unlike the inherited implementation,
 * which faked a session client-side when the password was wrong. The addresses
 * use the RFC 2606 `.invalid` TLD so they can never resolve to a real mailbox.
 */
const DEMO_ACCOUNTS = [
  { email: 'citizen@example.invalid', role: 'Citizen', note: 'Search, request an ambulance, file complaints' },
  { email: 'hospital@example.invalid', role: 'Hospital', note: 'Update bed & ICU availability' },
  { email: 'bloodbank@example.invalid', role: 'Blood bank', note: 'Update blood unit inventory' },
  { email: 'pharmacy@example.invalid', role: 'Pharmacy', note: 'Manage medicine stock' },
  { email: 'ambulance@example.invalid', role: 'Ambulance', note: 'Accept and dispatch requests' },
  { email: 'authority@example.invalid', role: 'Authority', note: 'Resolve complaints, publish schemes & alerts' },
  { email: 'admin@example.invalid', role: 'Admin', note: 'Verify organisations, manage users, audit log' },
];

const DEMO_PASSWORD = 'Password123!';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, isLoading, error, clearError, user, isInitialized } = useAuthStore();

  const [email, setEmail] = useState('citizen@example.invalid');
  const [password, setPassword] = useState(DEMO_PASSWORD);

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
      className="page-shell"
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

        <h2 className="section-title" style={{ marginTop: '1.25rem' }}>
          Demo accounts
        </h2>
        <p className="subtle" style={{ marginBottom: '0.75rem' }}>
          Password for all accounts: <code>{DEMO_PASSWORD}</code> — click a row to fill the form.
        </p>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="glass-card"
              style={{ textAlign: 'left', cursor: 'pointer', padding: '0.7rem 0.9rem' }}
              onClick={() => {
                clearError();
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{account.role}</span>
                <span className="subtle">{account.email}</span>
              </div>
              <div className="subtle" style={{ marginTop: '0.2rem' }}>
                {account.note}
              </div>
            </button>
          ))}
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
