const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem('access_token');
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || 'GET',
    headers: { ...headers(), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json())?.message || msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}