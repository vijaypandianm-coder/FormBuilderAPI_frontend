// tests/api/responses.api.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResponseService, ResponsesApi } from "@src/api/responses";
import { apiFetch } from "@src/api/http";

// Mock apiFetch
vi.mock("@src/api/http", () => ({
  apiFetch: vi.fn(),
}));

describe("api/responses", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("list throws if formKey missing", async () => {
    await expect(ResponseService.list()).rejects.toThrow("formKey is required");
  });

  it("list hits /api/responses/:formKey (no userId)", async () => {
    apiFetch.mockResolvedValue([{ id: 1 }]);

    const out = await ResponsesApi.list("FK1");
    expect(apiFetch).toHaveBeenCalledWith("/api/responses/FK1");
    expect(out).toEqual([{ id: 1 }]);
  });

  it("list appends userId when provided", async () => {
    apiFetch.mockResolvedValue([{ id: 5 }]);

    await ResponseService.list("FK2", "U-55");
    expect(apiFetch).toHaveBeenCalledWith("/api/responses/FK2?userId=U-55");
  });

  it("listMy calls /api/Response/my-submissions", async () => {
    apiFetch.mockResolvedValue([{ id: "A" }]);

    const out = await ResponseService.listMy();
    expect(apiFetch).toHaveBeenCalledWith("/api/Response/my-submissions");
    expect(out).toEqual([{ id: "A" }]);
  });

  it("getDetail requires responseId", async () => {
    await expect(ResponseService.getDetail()).rejects.toThrow(
      "responseId is required"
    );
  });

  it("getDetail calls /api/Response/:id", async () => {
    apiFetch.mockResolvedValue({ id: "XYZ" });

    const res = await ResponsesApi.getDetail("XYZ");
    expect(apiFetch).toHaveBeenCalledWith("/api/Response/XYZ");
    expect(res).toEqual({ id: "XYZ" });
  });
});