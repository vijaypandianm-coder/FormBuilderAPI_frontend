// src/api/http.js
const BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL_MONGO ||
  "http://localhost:5211"
).replace(/\/$/, "");

export async function apiFetch(path, options = {}) {
  const url = `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(options.headers || {});

  // ✅ Read token from BOTH stores (remembered / session)
  const token =
    localStorage.getItem("fb_token") ||
    sessionStorage.getItem("fb_token_ss");

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = await res.json();
      message = j?.message || j?.error || message;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}