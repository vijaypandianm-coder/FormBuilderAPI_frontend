// src/api/auth.js
const API_AUTH =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_BASE_URL_MONGO?.trim() ||
  "http://localhost:5211";

/** storage keys */
const LS_KEY = "fb_token";   // persisted (Remember me)
const SS_KEY = "fb_token_ss"; // session-only

function saveToken(token, remember) {
  try {
    if (remember) {
      localStorage.setItem(LS_KEY, token);
      sessionStorage.removeItem(SS_KEY);
    } else {
      sessionStorage.setItem(SS_KEY, token);
      localStorage.removeItem(LS_KEY);
    }
  } catch {}
}

function readToken() {
  try {
    return localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_KEY) || null;
  } catch {
    return null;
  }
}

async function api(path, init = {}) {
  const res = await fetch(`${API_AUTH}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
      if (j?.error) msg = j.error;
    } catch {}
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const AuthService = {
  /** POST /api/auth/login -> saves JWT. */
  async login({ email, password, remember = true }) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const token =
      data?.token ||
      data?.accessToken ||
      data?.jwt ||
      data?.data?.token;

    if (!token) throw new Error("Login failed: token not returned");
    saveToken(token, remember);
    return this.getProfile();
  },

  /** Optional register flow; saves token if backend returns one. */
  async register({ name, email, password }) {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    const token =
      data?.token ||
      data?.accessToken ||
      data?.jwt ||
      data?.data?.token;

    if (token) saveToken(token, true);
    return data;
  },

  /** Read the current JWT (if any) */
  getToken() {
    return readToken();
  },

  /** Authorization header helper for other APIs */
  authHeader() {
    const t = readToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  },

  /** Decode JWT payload (best-effort) */
  getProfile() {
    try {
      const t = readToken();
      if (!t) return null;
      const payload = JSON.parse(
        atob((t.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"))
      );
      return {
        id:
          payload?.sub ??
          payload?.nameid ??
          payload?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"],
        name: payload?.name || payload?.unique_name || payload?.given_name,
        email: payload?.email || payload?.upn,
        role:
          payload?.role ||
          (Array.isArray(payload?.roles) ? payload.roles[0] : payload?.roles) ||
          payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
        raw: payload,
      };
    } catch {
      return null;
    }
  },

  /** ✅ Restored so AdminDashboard won’t crash */
  isAuthenticated() {
    return !!this.getToken();
  },

  logout() {
    try {
      localStorage.removeItem(LS_KEY);
      sessionStorage.removeItem(SS_KEY);
    } catch {}
  },
};

export default AuthService;