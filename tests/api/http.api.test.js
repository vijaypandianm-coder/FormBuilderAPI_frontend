import { apiFetch } from "@src/api/http.js";

function mkRes({ ok=true, status=200, json={}, statusText="OK" } = {}) {
  return {
    ok, status, statusText,
    json: async () => json
  };
}

describe("api/http: apiFetch", () => {
  it("prefixes BASE, adds Authorization when token present and Content-Type with body", async () => {
    localStorage.setItem("fb_token", "token123");
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: { ok: true } }));

    const out = await apiFetch("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(out.ok).toBe(true);

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/x"); // BASE is empty by setup; path stays
    expect(init.headers.get("Authorization")).toBe("Bearer token123");
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });

  it("does not set Content-Type when no body", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: { a: 1 } }));
    await apiFetch("/api/y");
    const [, init] = spy.mock.calls[0];
    expect(init.headers.get("Content-Type")).toBeNull();
  });

  it("returns null for 204", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ status: 204, ok: true }));
    const res = await apiFetch("/api/no-content");
    expect(res).toBeNull();
  });

  it("throws error with JSON message when available", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({
      ok: false, status: 400, json: { message: "Bad payload" }, statusText: "Bad Request"
    }));
    await expect(apiFetch("/api/fail")).rejects.toMatchObject({ message: "Bad payload", status: 400 });
  });

  it("falls back to statusText when no JSON body", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false, status: 404, statusText: "Not Found",
      json: async () => { throw new Error("no json"); }
    });
    await expect(apiFetch("/api/missing")).rejects.toMatchObject({ message: "Not Found", status: 404 });
  });
});