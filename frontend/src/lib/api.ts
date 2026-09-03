import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const ACCESS_TOKEN_KEY = 'civicconnect_access_token';
export const REFRESH_TOKEN_KEY = 'civicconnect_refresh_token';
export const USER_KEY = 'civicconnect_user';

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function storeTokens(tokens: { accessToken: string; refreshToken?: string }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  // The backend rotates refresh tokens: the presented token is revoked and a
  // new one issued. Persisting only the access token left the old refresh
  // token in storage, so the next refresh presented a revoked token and reuse
  // detection killed every session for that user.
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// A bare axios client for the refresh call itself. It must not go through the
// `api` instance, or a 401 from /auth/refresh would recurse into this same
// handler.
const refreshClient = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Single-flight refresh.
 *
 * A dashboard fires several requests at once; if the access token has expired
 * they all 401 together. Without this, each one posts its own /auth/refresh,
 * and because the backend rotates tokens, the second call presents a token the
 * first already revoked — which trips reuse detection and logs the user out.
 * All concurrent 401s now await the same in-flight refresh.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('No refresh token available.');

  const res = await refreshClient.post('/auth/refresh', { refreshToken });
  const tokens = res.data?.data?.tokens ?? res.data?.tokens;
  if (!tokens?.accessToken) throw new Error('Refresh response did not contain an access token.');

  storeTokens(tokens);
  return tokens.accessToken as string;
}

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  // TransformInterceptor wraps every success as { success, data, meta? }.
  (response) => response.data,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as RetriableRequest | undefined;

    const canRetry =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      typeof window !== 'undefined' &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login');

    if (canRetry) {
      originalRequest._retry = true;
      try {
        refreshInFlight = refreshInFlight ?? refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
        const newToken = await refreshInFlight;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        // Retry through `api`, not bare `axios`: going around the instance
        // skipped the response interceptor, so a retried call resolved to a
        // raw AxiosResponse while a first-try call resolved to the unwrapped
        // envelope. Callers reading `result.data` broke intermittently.
        return api(originalRequest as AxiosRequestConfig);
      } catch {
        clearSession();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.assign('/login?expired=1');
        }
        return Promise.reject(new Error('Your session has expired. Please sign in again.'));
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred.';

    const normalized = new Error(message) as Error & { status?: number; correlationId?: string };
    normalized.status = error.response?.status;
    normalized.correlationId = error.response?.data?.correlationId;
    return Promise.reject(normalized);
  },
);

/** Envelope returned by the backend's TransformInterceptor. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: { total: number; page: number; limit: number; totalPages: number };
  timestamp: string;
}

/** Typed helpers — the response interceptor already unwrapped the AxiosResponse. */
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => api.get(url, config) as unknown as Promise<ApiEnvelope<T>>,
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    api.post(url, body, config) as unknown as Promise<ApiEnvelope<T>>,
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    api.patch(url, body, config) as unknown as Promise<ApiEnvelope<T>>,
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    api.put(url, body, config) as unknown as Promise<ApiEnvelope<T>>,
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    api.delete(url, config) as unknown as Promise<ApiEnvelope<T>>,
};
