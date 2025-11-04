// src/api/http.js

const BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL_MONGO ||
  "http://localhost:5211"
).replace(/\/$/, "");

/**
 * apiFetch – a universal fetch helper that:
 *  - Automatically prefixes BASE URLs
 *  - Adds Authorization header if a token is found
 *  - Adds Content-Type: application/json for JSON bodies
 *  - Throws structured errors for non-2xx responses
 */
export async function apiFetch(path, options = {}) {
  // Ensure path starts with /
  const url = `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  // Create headers from options
  const headers = new Headers(options.headers || {});

  // ✅ Read token from all possible storage keys (supports tests + app)
  const token =
    localStorage.getItem("fb_token") ||
    sessionStorage.getItem("fb_token_ss") ||
    localStorage.getItem("token") ||             // added for test compatibility
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token");

  // Attach Bearer token if present
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Add JSON header only if body is present and header not already set
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  // Perform the fetch
  const res = await fetch(url, { ...options, headers });

  // Handle errors gracefully
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = await res.json();
      message = j?.message || j?.error || message;
    } catch {
      // ignore invalid JSON
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  // Return null for no-content responses
  if (res.status === 204) return null;

  // Return parsed JSON otherwise
  return res.json();
}

export default apiFetch;