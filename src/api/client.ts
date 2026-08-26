import axios, { AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || ''; // Empty to use Vite proxy

export const api = axios.create({
  baseURL: BASE_URL,
});

// Inject auth token & handle FormData headers
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

// Handle 401 → attempt refresh
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original?._retry) {
      const refreshToken = sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
      if (refreshToken && original) {
        original._retry = true;
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          sessionStorage.setItem('token', data.access_token);
          localStorage.setItem('token', data.access_token);
          if (data.refresh_token) {
            sessionStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          original.headers!.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refresh_token');
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          if (!window.location.pathname.startsWith('/apply/')) {
            window.location.href = '/login';
          }
        }
      } else {
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');
        if (!window.location.pathname.startsWith('/apply/')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
