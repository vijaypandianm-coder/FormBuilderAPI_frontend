// tests/api/auth.api.test.js
import { describe, it, beforeEach, expect, vi } from "vitest";
import { AuthService } from "../../src/api/auth.js";

/** storage keys used by src/api/auth.js */
const LS_KEY = "fb_token";
const SS_KEY = "fb_token_ss";

/** base64url helper (no padding) */
function b64url(obj) {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(json).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** make a minimal unsigned JWT with given payload */
function makeJwt(payload) {
  const header = b64url({ alg: "none", typ: "JWT" });
  const body = b64url(payload);
  return `${header}.${body}.`; // signature empty for tests
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  // Reset storages
  localStorage.clear();
  sessionStorage.clear();
});

describe("AuthService", () => {
  it("stores token in localStorage by default (remember=true) and returns decoded profile", async () => {
    const jwt = makeJwt({
      sub: "u123",
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
    });

    // Mock fetch for POST /api/auth/login
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token: jwt }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const profile = await AuthService.login({
      email: "alice@example.com",
      password: "secret",
      // remember omitted → default true
    });

    // token stored in localStorage, not in sessionStorage
    expect(localStorage.getItem(LS_KEY)).toBe(jwt);
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();

    // profile decoded from the stored token
    expect(profile).toMatchObject({
      id: "u123",
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
    });

    // authHeader uses the stored token
    expect(AuthService.authHeader()).toEqual({ Authorization: `Bearer ${jwt}` });

    // Called login endpoint with correct payload
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body)).toEqual({
      email: "alice@example.com",
      password: "secret",
    });
  });

  it("stores token in sessionStorage when remember=false", async () => {
    const jwt = makeJwt({ sub: "s1", name: "Bob", email: "b@x.com", role: "editor" });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token: jwt }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await AuthService.login({ email: "b@x.com", password: "pw", remember: false });

    expect(sessionStorage.getItem(SS_KEY)).toBe(jwt);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it("getProfile prefers roles[0] when payload.roles is an array", () => {
    const jwt = makeJwt({
      sub: "r1",
      name: "Carol",
      email: "c@x.com",
      roles: ["editor", "viewer"],
    });
    localStorage.setItem(LS_KEY, jwt);

    const prof = AuthService.getProfile();
    expect(prof).toMatchObject({
      id: "r1",
      name: "Carol",
      email: "c@x.com",
      role: "editor",
    });
  });

  it("authHeader returns empty object when no token", () => {
    expect(AuthService.authHeader()).toEqual({});
  });

  it("register posts username/email/password and does not store a token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const resp = await AuthService.register({
      username: "newuser",
      email: "new@x.com",
      password: "pw",
    });
    expect(resp).toEqual({ ok: true });

    // no token persisted by register()
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();

    // request details
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/register$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body)).toEqual({
      username: "newuser",
      email: "new@x.com",
      password: "pw",
    });
  });

  it("logout clears both local and session token slots", () => {
    localStorage.setItem(LS_KEY, "x");
    sessionStorage.setItem(SS_KEY, "y");

    AuthService.logout();

    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();
  });

  it("login throws with message from server when HTTP not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      AuthService.login({ email: "bad@x.com", password: "nope" })
    ).rejects.toThrow(/Invalid credentials|HTTP 401/);

    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(sessionStorage.getItem(SS_KEY)).toBeNull();
  });
});