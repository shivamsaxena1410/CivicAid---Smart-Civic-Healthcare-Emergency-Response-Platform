'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Floating demo-credentials panel.
 *
 * The seeded accounts used to be printed down the side of the login page, which
 * made the first screen of the product read as a test fixture. They are still
 * needed — an evaluator has no other way in — so they live behind a small
 * button pinned to the bottom-left corner instead.
 *
 * These are real rows in the development database (backend/prisma/seed.ts) and
 * authenticate against the real API. The addresses use the RFC 2606 `.invalid`
 * TLD so they can never resolve to a real mailbox, and the shared password is
 * only meaningful against a disposable local database.
 */

export const DEMO_PASSWORD = 'Password123!';

export interface DemoAccount {
  email: string;
  role: string;
  note: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'citizen@example.invalid', role: 'Citizen', note: 'Search, request an ambulance, file complaints' },
  { email: 'hospital@example.invalid', role: 'Hospital', note: 'Update bed & ICU availability' },
  { email: 'bloodbank@example.invalid', role: 'Blood bank', note: 'Update blood unit inventory' },
  { email: 'pharmacy@example.invalid', role: 'Pharmacy', note: 'Manage medicine stock' },
  { email: 'ambulance@example.invalid', role: 'Ambulance', note: 'Accept and dispatch requests' },
  { email: 'authority@example.invalid', role: 'Authority', note: 'Resolve complaints, publish schemes & alerts' },
  { email: 'ngo@example.invalid', role: 'NGO', note: 'Coordinate outreach and camps' },
  { email: 'admin@example.invalid', role: 'Admin', note: 'Verify organisations, manage users, audit log' },
];

interface DemoCredentialsProps {
  /**
   * Called when an account row is picked. The login page uses this to fill its
   * form; pages without a sign-in form (register) simply omit it, and the rows
   * then act as copy-to-clipboard targets only.
   */
  onSelect?: (account: { email: string; password: string }) => void;
}

export function DemoCredentials({ onSelect }: DemoCredentialsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus returns to the toggle so keyboard users are not
  // dropped at the top of the document.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Clear the "Copied" acknowledgement without leaving a timer behind if the
  // component unmounts (route change) while it is pending.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      // Clipboard access is denied outside a secure context; the value is
      // visible on screen regardless, so there is nothing to recover from.
    }
  };

  return (
    <div ref={rootRef} className="cc-demo-creds">
      {open ? (
        <div className="cc-demo-creds__panel" role="dialog" aria-label="Demo credentials" id="cc-demo-creds-panel">
          <div className="cc-demo-creds__head">
            <div>
              <strong>Demo accounts</strong>
              <p className="cc-demo-creds__sub">
                Seeded fictional users. {onSelect ? 'Pick one to fill the form.' : 'Click to copy an address.'}
              </p>
            </div>
            <button
              type="button"
              className="cc-demo-creds__close"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
              aria-label="Close demo credentials"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            className="cc-demo-creds__password"
            onClick={() => copy(DEMO_PASSWORD, 'password')}
            title="Copy password"
          >
            <span className="cc-demo-creds__sub">Password (all accounts)</span>
            <code>{DEMO_PASSWORD}</code>
            <span className="cc-demo-creds__copy">{copied === 'password' ? 'Copied' : 'Copy'}</span>
          </button>

          <ul className="cc-demo-creds__list">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="cc-demo-creds__row"
                  onClick={() => {
                    if (onSelect) {
                      onSelect({ email: account.email, password: DEMO_PASSWORD });
                      setOpen(false);
                    } else {
                      void copy(account.email, account.email);
                    }
                  }}
                >
                  <span className="cc-demo-creds__role">{account.role}</span>
                  <span className="cc-demo-creds__email">
                    {copied === account.email ? 'Copied' : account.email}
                  </span>
                  <span className="cc-demo-creds__note">{account.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        ref={toggleRef}
        type="button"
        className="cc-demo-creds__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="cc-demo-creds-panel"
      >
        <span aria-hidden>🔑</span>
        <span>Demo credentials</span>
      </button>
    </div>
  );
}
