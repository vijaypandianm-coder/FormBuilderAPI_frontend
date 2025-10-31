import ResponseService, { ResponseService as Named, ResponsesApi } from "@src/api/responses.js";

function mkRes({ ok=true, status=200, json={}, statusText="OK" } = {}) {
  return { ok, status, statusText, json: async () => json };
}

describe("api/responses", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list throws if formKey missing", async () => {
    await expect(ResponseService.list()).rejects.toThrow(/formKey is required/i);
  });

  it("list hits /api/responses/:formKey (no userId)", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: [{ id: 1 }] }));
    const out = await ResponsesApi.list("FK1");
    expect(out).toEqual([{ id: 1 }]);
    expect(spy).toHaveBeenCalledWith("/api/responses/FK1", expect.any(Object));
  });

  it("list appends userId when provided", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: [{ id: 2 }] }));
    await Named.list("FK2", "U-55");
    const [url] = spy.mock.calls[0];
    expect(url).toBe("/api/responses/FK2?userId=U-55");
  });

  it("listMy calls /api/Response/my-submissions", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: [1] }));
    await ResponseService.listMy();
    expect(spy).toHaveBeenCalledWith("/api/Response/my-submissions", expect.any(Object));
  });

  it("getDetail requires responseId", async () => {
    await expect(ResponseService.getDetail("")).rejects.toThrow(/responseId is required/i);
  });

  it("getDetail calls /api/Response/:id", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: { id: 99 } }));
    const res = await ResponseService.getDetail("99");
    expect(res).toEqual({ id: 99 });
    expect(spy).toHaveBeenCalledWith("/api/Response/99", expect.any(Object));
  });
});