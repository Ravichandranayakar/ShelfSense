/**
 * Centralized API Client for ShelfSense Storefront
 * Handles dynamic base URL resolution for both local development and Render deployment.
 */

const RAW_API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).trim();

// Strip trailing slash if present
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

/**
 * Returns a fully qualified API endpoint URL.
 * In local dev (empty VITE_API_URL), returns relative path e.g. "/api/products".
 * In Render production (e.g. VITE_API_URL="https://backend.onrender.com"),
 * returns "https://backend.onrender.com/api/products".
 */
export function getApiUrl(path) {
  if (!path) return API_BASE_URL || '/';
  // If already absolute URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Generic API request wrapper with standardized JSON parsing and error handling.
 */
export async function api(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const url = getApiUrl(path);

  const res = await fetch(url, {
    headers,
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.detail || data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export default api;
