import { UsersApi } from "@src/api/users.js";

function mkRes({ ok=true, status=200, json={}, statusText="OK" } = {}) {
  return { ok, status, statusText, json: async () => json };
}

describe("api/users", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("byIds returns first successful candidate", async () => {
    const calls = [];
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      calls.push(url);
      // First candidate in byIds should succeed
      if (url.startsWith("/api/users/by-ids")) {
        return Promise.resolve(mkRes({ json: [{ id: "1" }] }));
      }
      return Promise.resolve(mkRes({ ok: false, status: 404 }));
    });

    const res = await UsersApi.byIds(["1","2"]);
    expect(res).toEqual([{ id: "1" }]);
    expect(calls[0]).toMatch(/\/api\/users\/by-ids\?ids=1%2C2$/);
  });

  it("get tries multiple candidates until success", async () => {
    const calls = [];
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      calls.push(url);
      // fail first two, succeed on the 3rd
      if (url === "/api/users/42" || url === "/api/admin/users/42") {
        return Promise.resolve(mkRes({ ok: false, status: 404 }));
      }
      if (url === "/users/42") {
        return Promise.resolve(mkRes({ json: { id: 42, name: "Neo" } }));
      }
      return Promise.resolve(mkRes({ ok: false, status: 404 }));
    });

    const user = await UsersApi.get(42);
    expect(user).toEqual({ id: 42, name: "Neo" });
    expect(calls).toEqual([
      "/api/users/42",
      "/api/admin/users/42",
      "/users/42"
    ]);
  });

  it("returns null when all candidates fail", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ ok: false, status: 404 }));
    const r = await UsersApi.get("x");
    expect(r).toBeNull();
  });
});