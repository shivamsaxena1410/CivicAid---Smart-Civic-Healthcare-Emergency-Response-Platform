import { create } from 'zustand';
import { User, Role } from '../types';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<void>;
  demoLogin: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const DEMO_CREDENTIALS: Record<Role, { email: string; name: string }> = {
  ADMIN: { email: 'admin@civicconnect.org', name: 'Dr. Ramesh Sharma (Admin)' },
  AUTHORITY: { email: 'health.dept@karnataka.gov.in', name: 'District Health Officer (Authority)' },
  CITIZEN: { email: 'citizen@example.com', name: 'Priya Sundaram (Citizen)' },
  HOSPITAL: { email: 'admin@manipalhospitals.com', name: 'Manipal Hospital Operations' },
  BLOOD_BANK: { email: 'contact@redcrossbangalore.org', name: 'Red Cross Blood Centre' },
  PHARMACY: { email: 'koramangala@apollopharmacy.org', name: 'Apollo Pharmacy Lead' },
  AMBULANCE: { email: 'dispatch@stanplus.com', name: 'StanPlus Emergency Fleet' },
  NGO: { email: 'care@sevadrive.org', name: 'Seva Health Foundation' },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email: string, password = 'Password123!') => {
    set({ isLoading: true, error: null });
    try {
      const response: any = await api.post('/auth/login', { email, password });
      const { user, tokens } = response.data || response;

      localStorage.setItem('civicconnect_access_token', tokens.accessToken);
      localStorage.setItem('civicconnect_refresh_token', tokens.refreshToken);
      localStorage.setItem('civicconnect_user', JSON.stringify(user));

      set({ user, token: tokens.accessToken, isLoading: false });
    } catch (err: any) {
      // For instant offline demo responsiveness if backend database isn't locally running
      const matchedRole = Object.entries(DEMO_CREDENTIALS).find(([_, cred]) => cred.email === email);
      if (matchedRole) {
        const [roleKey, cred] = matchedRole;
        const mockUser: User = {
          id: `mock-user-${roleKey.toLowerCase()}`,
          email: cred.email,
          name: cred.name,
          role: roleKey as Role,
          isActive: true,
          isVerified: true,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem('civicconnect_user', JSON.stringify(mockUser));
        localStorage.setItem('civicconnect_access_token', 'mock_demo_jwt_token_2026');
        set({ user: mockUser, token: 'mock_demo_jwt_token_2026', isLoading: false });
        return;
      }

      set({ error: err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  demoLogin: async (role: Role) => {
    const cred = DEMO_CREDENTIALS[role];
    if (cred) {
      await get().login(cred.email, 'Password123!');
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout network errors
    } finally {
      localStorage.removeItem('civicconnect_access_token');
      localStorage.removeItem('civicconnect_refresh_token');
      localStorage.removeItem('civicconnect_user');
      set({ user: null, token: null });
    }
  },

  checkAuth: async () => {
    if (typeof window === 'undefined') return;

    const storedUser = localStorage.getItem('civicconnect_user');
    const storedToken = localStorage.getItem('civicconnect_access_token');

    if (storedUser && storedToken) {
      try {
        set({ user: JSON.parse(storedUser), token: storedToken });
        const res: any = await api.get('/auth/me');
        if (res.data) {
          set({ user: res.data });
          localStorage.setItem('civicconnect_user', JSON.stringify(res.data));
        }
      } catch (e) {
        // Fallback to local stored session if offline
        set({ user: JSON.parse(storedUser), token: storedToken });
      }
    }
  },

  setUser: (user: User | null) => set({ user }),
}));
