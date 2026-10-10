import axios from 'axios';
import { enqueueRequest, cacheResponse, getCachedResponse } from './offlineQueue';

// In development, use a relative URL so requests go through the Vite proxy
// (same-origin → no CORS/cookie headaches). In production, use the full backend URL.
const BACKEND_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,   // Send httpOnly cookies automatically on every request
});

// Endpoints that are safe to cache (read-only dashboards and lists)
const CACHEABLE_PATTERNS = [
  '/admin/dashboard',
  '/finance/dashboard',
  '/academic/subjects',
  '/academic/classes',
  '/academic/students',
  '/schemes/my-dashboard',
  '/schemes/management-dashboard',
  '/lessons-v2/my-dashboard',
  '/lessons-v2/management-dashboard',
  '/hr/dashboard',
  '/monitoring/',
  '/behaviour/notifications/unread-count',
  '/admin/staff',
  '/timetable',
];

function isCacheable(url) {
  return CACHEABLE_PATTERNS.some(p => url.includes(p));
}

// ── Request interceptor ──
// Cookies are sent automatically (withCredentials: true).
// Authorization header is kept as a fallback for Swagger / external API clients.
api.interceptors.request.use((config) => {
  return config;
});

// ── Response interceptor: cache GET, queue mutations offline, handle 401 ──
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses for offline use
    const { config } = response;
    if (config.method === 'get' && isCacheable(config.url)) {
      const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
      const cacheKey = config.params
        ? `${fullUrl}?${new URLSearchParams(config.params).toString()}`
        : fullUrl;
      cacheResponse(cacheKey, response.data, 10 * 60 * 1000); // 10 min TTL
    }
    return response;
  },
  async (error) => {
    // Handle 401 — cookie is cleared by the backend; redirect to login only
    // when the visitor is already inside a protected (admin) area.
    // Public website pages fire /auth/me as an optional check — a 401 there is
    // expected for unauthenticated visitors and must NOT redirect them.
    if (error.response?.status === 401) {
      localStorage.removeItem('rw_user');
      const path = window.location.pathname;
      const PUBLIC_PATHS = ['/', '/about', '/academics', '/admissions', '/student-life', '/gallery', '/contact'];
      const isPublicPage = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
      if (
        !isPublicPage &&
        !path.includes('/login') &&
        !window.location.hash.includes('session_id')
      ) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // If offline (network error, no response), handle gracefully
    if (!error.response && !navigator.onLine) {
      const { config } = error;

      // For GET requests: serve from IndexedDB cache
      if (config.method === 'get') {
        const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
        const cacheKey = config.params
          ? `${fullUrl}?${new URLSearchParams(config.params).toString()}`
          : fullUrl;

        const cached = await getCachedResponse(cacheKey);
        if (cached) {
          // Return a fake axios response from cache
          return {
            data: cached,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
            _fromCache: true,
          };
        }
      }

      // For mutation requests (POST/PUT/DELETE): queue for later sync
      if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
        const fullUrl = config.baseURL
          ? `${config.baseURL}${config.url}`
          : config.url;

        await enqueueRequest(
          config.method,
          fullUrl,
          config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : null,
          {
            'Content-Type': config.headers['Content-Type'] || 'application/json',
            Authorization: config.headers.Authorization,
          }
        );

        // Return a fake success response so the UI doesn't break
        return {
          data: { message: 'Queued for sync', _offline: true },
          status: 202,
          statusText: 'Queued (offline)',
          headers: {},
          config,
          _queued: true,
        };
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE, BACKEND_URL };
