import axios from 'axios'

const TOKEN_KEY = 'sb_token'
const USER_KEY = 'sb_user'

// API_BASE: empty in dev so /api goes through Vite proxy; full backend URL in
// production via VITE_API_BASE_URL set in Render. Vite bakes this in at BUILD
// TIME, so changing the env var on Render requires a fresh deploy.
// We strip a trailing slash so "https://x.onrender.com/" and "https://x.onrender.com"
// both work — easy thing to get wrong in the dashboard.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

/**
 * Build an absolute URL for files served by the backend (e.g. poster images at
 * /uploads/abc.jpg). In dev, returns the relative path (Vite proxy handles it).
 * In prod, prefixes with the backend's full URL.
 *
 * Usage: <img src={mediaUrl(event.poster_url)} />
 */
export function mediaUrl(path) {
  if (!path) return path
  // already absolute (http/https) — leave alone (future-proof for Cloudinary, etc.)
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path}`
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}
export function setStoredUser(u) {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}

// baseURL: API_BASE + /api. In dev, API_BASE is "" so we get "/api" (proxied).
// In prod, we get "https://shebelieves-api.onrender.com/api" → hits the backend.
export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const t = getToken()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // token expired or invalid — clear and bounce to appropriate login
      const path = window.location.pathname
      setToken(null)
      setStoredUser(null)
      if (path.startsWith('/admin') || path.startsWith('/org')) {
        if (!path.includes('/login')) window.location.href = '/staff/login'
      } else if (path.startsWith('/gate')) {
        if (path !== '/gate/login') window.location.href = '/gate/login'
      } else if (
        path.startsWith('/checkout') ||
        path.startsWith('/my-') ||
        path.startsWith('/notifications') ||
        path.startsWith('/orders')
      ) {
        if (!path.includes('/login')) window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export function apiError(err, fallback = 'Something went wrong, sister.') {
  return err?.response?.data?.error || err?.message || fallback
}
