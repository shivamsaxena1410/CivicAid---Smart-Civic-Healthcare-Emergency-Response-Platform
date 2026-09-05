'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { ErrorNote, Field } from '../../components/ui';
import { DemoCredentials } from '../../components/DemoCredentials';
import type { Role } from '../../types';

/**
 * Roles the API permits at self-registration.
 *
 * Mirrors `SELF_REGISTERABLE_ROLES` in the backend's RegisterDto. ADMIN and
 * AUTHORITY are absent there and rejected with 400, so offering them here would
 * only produce a dead-end form. Organisation accounts register freely but stay
 * PENDING until an admin approves them — they cannot publish availability data
 * before that.
 */
const ROLE_OPTIONS: Array<{ value: Role; label: string; note?: string }> = [
  { value: 'CITIZEN', label: 'Citizen' },
  { value: 'HOSPITAL', label: 'Hospital', note: 'requires admin approval' },
  { value: 'BLOOD_BANK', label: 'Blood bank', note: 'requires admin approval' },
  { value: 'PHARMACY', label: 'Pharmacy', note: 'requires admin approval' },
  { value: 'AMBULANCE', label: 'Ambulance provider', note: 'requires admin approval' },
  { value: 'NGO', label: 'NGO', note: 'requires admin approval' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error } = useAuthStore();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'CITIZEN' as Role,
  });

  const selected = ROLE_OPTIONS.find((r) => r.value === form.role);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        // Send `phone` only when filled: the DTO marks it optional, and an
        // empty string is a value, not an absence.
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        role: form.role,
      });
      router.replace('/dashboard');
    } catch {
      /* message is in the store */
    }
  };

  return (
    <div className="page-shell cc-auth-page cc-register-page" style={{ maxWidth: 520, paddingTop: '3rem' }}>
      <h1 style={{ fontSize: '1.7rem', fontWeight: 700 }}>Create an account</h1>
      <p className="muted" style={{ marginTop: '0.4rem', marginBottom: '1.25rem' }}>
        Citizen accounts are usable immediately. Organisation accounts are reviewed by an administrator before
        their availability data appears in public search.
      </p>

      <ErrorNote error={error ? new Error(error) : null} />

      <form onSubmit={onSubmit} className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '0.9rem' }}>
        <Field label="Full name">
          <input
            className="input-control"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="input-control"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            className="input-control"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input
            className="input-control"
            type="password"
            minLength={8}
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Account type" hint={selected?.note}>
          <select
            className="input-control"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <button className="btn-primary" type="submit" disabled={isLoading} style={{ justifyContent: 'center' }}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="subtle" style={{ marginTop: '1rem' }}>
        Already registered? <Link href="/login" style={{ color: 'var(--accent-cyan)' }}>Sign in</Link>.
      </p>

      {/* No form to fill here, so the rows copy the address to the clipboard. */}
      <DemoCredentials />
    </div>
  );
}
