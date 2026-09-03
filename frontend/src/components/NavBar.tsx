'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isProvider, isStaff, useAuthStore } from '../store/auth.store';

const CITIZEN_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/discover', label: 'Discover' },
  { href: '/hospitals', label: 'Hospitals' },
  { href: '/blood-banks', label: 'Blood' },
  { href: '/pharmacies', label: 'Pharmacies' },
  { href: '/ambulance', label: 'Ambulance' },
  { href: '/complaints', label: 'Complaints' },
  { href: '/schemes', label: 'Schemes' },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const links = [...CITIZEN_LINKS];
  if (isProvider(user?.role)) links.push({ href: '/provider', label: 'Provider console' });
  if (isStaff(user?.role)) links.push({ href: '/admin', label: 'Admin' });

  return (
    <nav
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(14px)',
        position: 'sticky',
        top: 0,
        zIndex: 500,
      }}
    >
      <div
        className="page-shell"
        style={{
          paddingTop: '0.7rem',
          paddingBottom: '0.7rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 700 }}>
          Civic<span style={{ color: 'var(--accent-cyan)' }}>Connect</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.15rem', flexWrap: 'wrap', flex: 1 }}>
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  textDecoration: 'none',
                  fontSize: '0.87rem',
                  padding: '0.4rem 0.7rem',
                  borderRadius: 'var(--radius-sm)',
                  color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  background: active ? 'rgba(6,182,212,0.12)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <span className="subtle" style={{ textAlign: 'right' }}>
              {user.name}
              <br />
              <span className="badge badge-cyan">{user.role.replace('_', ' ').toLowerCase()}</span>
            </span>
            <button
              className="btn-secondary"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
