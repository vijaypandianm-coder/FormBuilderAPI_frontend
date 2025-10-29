// src/api/auth.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_BASE_URL_MONGO?.trim() ||
  "http://localhost:5211";

const TOKEN_KEY = "fb_token";
const USER_KEY  = "fb_user"; // { email, role }

async function http(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    credentials: "omit",
    ...opts,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    throw new Error(msg);
  }
  // try json; allow empty 204 etc.
  try { return await res.json(); } catch { return null; }
}

export const AuthService = {
  /** POST /api/auth/login -> { token, role, email, expiresIn? } */
  async login({ email, password }) {
    const body = JSON.stringify({ email, password });
    const data = await http("/api/auth/login", { method: "POST", body });

    if (!data?.token) throw new Error("Invalid login response");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ email: data.email || email, role: data.role || "Learner" })
    );
    return data;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  },

  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  },

  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  /** Auth header helper for other APIs */
  authHeader() {
    const t = AuthService.getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  },
};