import { create } from 'zustand';
import { User, Role } from '../types';
import { api, clearSession, storeTokens, ACCESS_TOKEN_KEY, USER_KEY } from '../lib/api';

interface LoginResult {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  /** Distinguishes "not checked yet" from "checked, not signed in". */
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: Role;
  }) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

/**
 * There is no offline/mock branch here.
 *
 * The inherited store caught a failed login and, if the email matched a
 * hardcoded table, wrote a fabricated user and the literal string
 * `mock_demo_jwt_token_2026` into localStorage — so a wrong password, or an API
 * that was simply down, produced a signed-in ADMIN session in the UI. Every
 * subsequent request carried a token the backend rejects, meaning the app
 * showed authenticated screens over data it never actually fetched. Auth state
 * now comes from the API or not at all.
 *
 * Demo accounts live in the seed (see backend/prisma/seed.ts) and are listed on
 * the login page; they authenticate for real.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, tokens } = (res as unknown as { data: LoginResult }).data;

      storeTokens(tokens);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, token: tokens.accessToken, isLoading: false, isInitialized: true });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      set({ error: message, isLoading: false, user: null, token: null });
      throw err;
    }
  },

  register: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/register', input);
      const { user, tokens } = (res as unknown as { data: LoginResult }).data;

      storeTokens(tokens);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, token: tokens.accessToken, isLoading: false, isInitialized: true });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // A failed logout call still clears the client session below; the server
      // revokes on refresh-token reuse regardless.
    } finally {
      clearSession();
      set({ user: null, token: null, isInitialized: true });
    }
  },

  checkAuth: async () => {
    if (typeof window === 'undefined') return;

    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!storedToken) {
      set({ user: null, token: null, isInitialized: true });
      return;
    }

    // Render optimistically from the cached profile, then confirm with the API.
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        set({ user: JSON.parse(storedUser) as User, token: storedToken });
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }

    try {
      const res = await api.get('/auth/me');
      const user = (res as unknown as { data: User }).data;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, token: localStorage.getItem(ACCESS_TOKEN_KEY), isInitialized: true });
    } catch {
      // The inherited version fell back to the cached user "if offline", which
      // meant a revoked or expired session kept rendering as signed-in
      // indefinitely. If the server will not confirm the session, there is no
      // session. (The api interceptor has already tried a token refresh.)
      clearSession();
      set({ user: null, token: null, isInitialized: true });
    }
  },

  setUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
}));

/** Roles that operate a facility and therefore see the provider console. */
export const PROVIDER_ROLES: Role[] = ['HOSPITAL', 'BLOOD_BANK', 'PHARMACY', 'AMBULANCE', 'NGO'];

export function isProvider(role?: Role | null): boolean {
  return !!role && PROVIDER_ROLES.includes(role);
}

export function isStaff(role?: Role | null): boolean {
  return role === 'ADMIN' || role === 'AUTHORITY';
}
