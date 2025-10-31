vi.mock("@src/api/auth.js", () => {
  return {
    AuthService: {
      authHeader: () => ({ Authorization: "Bearer test-token" })
    }
  };
});

import { FormService } from "@src/api/forms.js";

function mkRes({ ok=true, status=200, json={}, statusText="OK" } = {}) {
  return {
    ok, status, statusText,
    json: async () => json
  };
}

const BASE = "http://localhost:5211"; // fallback in your file

describe("api/forms: primitives", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list builds query correctly", async () => {
    const data = [{ id: 1 }];
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValue(mkRes({ json: data }));

    const res = await FormService.list();
    expect(res).toEqual(data);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE}/api/forms?status=All&page=1&pageSize=20`);
    expect(init.headers["Authorization"]).toBe("Bearer test-token");
  });

  it("get encodes formKey", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: { id: 11 } }));
    await FormService.get("A B");
    expect(fetch).toHaveBeenCalledWith(`${BASE}/api/forms/A%20B`, expect.any(Object));
  });

  it("layout maps dto.layout", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: { layout: [{ title: "S1" }] } }));
    const res = await FormService.layout("k1");
    expect(res.sections).toEqual([{ title: "S1" }]);
  });

  it("remove sends DELETE", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: null }));
    await FormService.remove("k2");
    const [, init] = spy.mock.calls[0];
    expect(init.method).toBe("DELETE");
  });

  it("clone posts to /clone", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: { ok: true } }));
    await FormService.clone("abc");
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(`${BASE}/api/forms/abc/clone`);
    expect(init.method).toBe("POST");
  });
});

describe("api/forms: create & update flows", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("create -> meta POST -> layout PUT -> status PATCH and returns formKey", async () => {
    const calls = [];
    vi.spyOn(global, "fetch").mockImplementation((url, init = {}) => {
      calls.push({ url, method: init.method || "GET", body: init.body || null });
      if (url.endsWith("/api/forms/meta") && init.method === "POST") {
        return Promise.resolve(mkRes({ json: { formKey: "FK123" } }));
      }
      if (url.endsWith("/api/forms/FK123/layout") && init.method === "PUT") {
        const parsed = JSON.parse(init.body);
        // options -> choices mapping happens here
        expect(parsed.sections[0].fields[1].choices).toEqual([
          { id: "1", text: "Yes" }, { id: "2", text: "No" }
        ]);
        return Promise.resolve(mkRes({ json: { ok: true } }));
      }
      if (url.endsWith("/api/forms/FK123/status") && init.method === "PATCH") {
        expect(JSON.parse(init.body)).toEqual({ status: "Published" });
        return Promise.resolve(mkRes({ json: { ok: true } }));
      }
      return Promise.resolve(mkRes({ json: {} }));
    });

    const payload = {
      title: "My Form",
      description: "Desc",
      access: "Open",
      status: "Published",
      layout: [
        {
          title: "Section A",
          fields: [
            { fieldId: "f1", label: "Name", type: "text", required: true },
            { id: "f2", label: "Opt", type: "radio", options: ["Yes", "No"] }
          ]
        }
      ]
    };

    const out = await FormService.create(payload);
    expect(out).toEqual({ formKey: "FK123" });

    // sanity: 3 network calls
    expect(calls.map(c => `${c.method} ${c.url.replace(BASE, "")}`)).toEqual([
      "POST /api/forms/meta",
      "PUT /api/forms/FK123/layout",
      "PATCH /api/forms/FK123/status",
    ]);
  });

  it("create throws if meta does not return formKey", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: {} }));
    await expect(FormService.create({ title: "x", layout: [] }))
      .rejects.toThrow(/formKey not returned/i);
  });

  it("update calls updateMeta, updateLayout, updateStatus", async () => {
    const calls = [];
    vi.spyOn(global, "fetch").mockImplementation((url, init = {}) => {
      calls.push({ url, method: init.method || "GET", body: init.body || null });
      return Promise.resolve(mkRes({ json: { ok: true } }));
    });

    const payload = {
      title: "T",
      description: "D",
      access: "Open",
      status: "Draft",
      layout: [{ title: "S1", fields: [{ label: "Q1" }] }]
    };

    const out = await FormService.update("FK9", payload);
    expect(out).toEqual({ formKey: "FK9" });

    const methods = calls.map(c => c.method);
    expect(methods).toEqual(["PUT", "PUT", "PATCH"]);
    expect(calls[0].url).toBe(`${BASE}/api/forms/FK9/meta`);
    expect(calls[1].url).toBe(`${BASE}/api/forms/FK9/layout`);
    expect(calls[2].url).toBe(`${BASE}/api/forms/FK9/status`);
  });
});

describe("api/forms: published listing & cards", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listPublished normalizes, filters only Published, and sorts by publishedAt desc", async () => {
    const payload = {
      items: [
        { FormKey: "A", Title: "Old", Description: "d1", Status: "Published", PublishedAt: "2022-01-01" },
        { formKey: "B", title: "New", description: "d2", status: "Published", publishedAt: "2024-01-01" },
        { key: "C", title: "Draft", description: "d3", status: "Draft" }
      ]
    };
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: payload }));

    const out = await FormService.listPublished();
    expect(out.map(x => x.formKey)).toEqual(["B", "A"]); // C filtered out
    expect(out[0]).toMatchObject({ title: "New", description: "d2", status: "Published" });
  });

  it("getPublishedCards maps subset from listPublished", async () => {
    const payload = [
      { formKey: "X", title: "T1", description: "D1", status: "Published", publishedAt: "2024-05-05" }
    ];
    // First call for listPublished:
    vi.spyOn(global, "fetch").mockResolvedValue(mkRes({ json: payload }));
    const cards = await FormService.getPublishedCards();
    expect(cards).toEqual([{ formKey: "X", title: "T1", description: "D1", publishedAt: "2024-05-05" }]);
  });
});