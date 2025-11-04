// tests/api/http.api.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "@src/api/http.js";

const ogFetch = global.fetch;

beforeEach(() => { global.fetch = vi.fn(); });
afterAll(() => { global.fetch = ogFetch; });

describe("apiFetch", () => {
  it("adds headers and returns JSON on ok", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ ok: 1 })
    });
    const res = await apiFetch("/ping", { method: "GET" });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/ping"), expect.objectContaining({
      method: "GET", headers: expect.any(Object)
    }));
    expect(res).toEqual({ ok: 1 });
  });

  it("throws on non-ok with status info", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false, status: 500, statusText: "Server Err", text: async () => "boom"
    });
    await expect(apiFetch("/err")).rejects.toThrow(/500|Server Err|boom/);
  });
});