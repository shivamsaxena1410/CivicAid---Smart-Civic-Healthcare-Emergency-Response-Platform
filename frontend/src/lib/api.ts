import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach JWT access token to outbound requests
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('civicconnect_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for extracting response envelope
api.interceptors.response.use(
  (response) => {
    return response.data; // TransformInterceptor provides { success: true, data: ... }
  },
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('civicconnect_refresh_token');

      if (refreshToken) {
        try {
          const res: any = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          if (res.data?.data?.tokens?.accessToken) {
            const newToken = res.data.data.tokens.accessToken;
            localStorage.setItem('civicconnect_access_token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axios(originalRequest);
          }
        } catch (refreshErr) {
          localStorage.removeItem('civicconnect_access_token');
          localStorage.removeItem('civicconnect_refresh_token');
          localStorage.removeItem('civicconnect_user');
        }
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred.';

    return Promise.reject(new Error(message));
  },
);
