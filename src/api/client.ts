/**
 * Axios client with automatic JWT token management.
 * - Access token: stored in memory (secure — not in localStorage)
 * - Refresh token: stored in localStorage (needed for page refresh)
 * - Auto-refresh: when API returns 401, automatically gets new access token
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

// ── Token storage (in-memory for security) ─────────────────────────────────
// Page refresh ke baad localStorage se accessToken restore karo
let _accessToken: string | null = localStorage.getItem('pf_accessToken');

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) localStorage.setItem('pf_accessToken', token);
  else localStorage.removeItem('pf_accessToken');
}
export function getAccessToken(): string | null { return _accessToken; }

// ── Queue for requests waiting for token refresh ───────────────────────────
let _isRefreshing = false;
type QueueItem = { resolve: (v: string) => void; reject: (e: unknown) => void };
let _queue: QueueItem[] = [];

function flushQueue(error: unknown, token: string | null) {
  _queue.forEach(item => error ? item.reject(error) : item.resolve(token!));
  _queue = [];
}

// ── Axios instance ─────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
client.interceptors.request.use(config => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

// Handle 401 — auto refresh token
client.interceptors.response.use(
  res => res.data,                           // unwrap .data automatically
  async error => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      // If already refreshing, queue this request
      if (_isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          _queue.push({ resolve, reject });
        }).then(newToken => {
          original.headers.Authorization = `Bearer ${newToken}`;
          return client(original);
        });
      }

      original._retry = true;
      _isRefreshing = true;

      const refreshToken = localStorage.getItem('pf_refreshToken');
      if (!refreshToken) {
        _isRefreshing = false;
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(new Error('Session expired. Please login again.'));
      }

      try {
        // Use plain axios (not client) to avoid infinite loop
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;

        setAccessToken(newAccess);
        localStorage.setItem('pf_refreshToken', newRefresh);

        flushQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return client(original);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        setAccessToken(null);
        localStorage.removeItem('pf_refreshToken');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(new Error('Session expired. Please login again.'));
      } finally {
        _isRefreshing = false;
      }
    }

    // Extract error message from API response
    const msg = error.response?.data?.message ?? error.message ?? 'Something went wrong';
    return Promise.reject(new Error(msg));
  }
);

export default client;
