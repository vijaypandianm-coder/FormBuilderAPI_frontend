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

  //
  // NEW TESTS to cover listMyPaged
  //
  it("listMyPaged builds URL with default pagination and no q", async () => {
    apiFetch.mockResolvedValue({ items: [], total: 0 });

    const res = await ResponseService.listMyPaged();

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/Response/my-submissions?page=1&pageSize=10"
    );
    expect(res).toEqual({ items: [], total: 0 });
  });

  it("listMyPaged includes trimmed q and custom paging", async () => {
    apiFetch.mockResolvedValue({ items: [{ id: "X" }], total: 1 });

    const res = await ResponseService.listMyPaged({
      page: 2,
      pageSize: 25,
      q: "  hello  ",
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/Response/my-submissions?page=2&pageSize=25&q=hello"
    );
    expect(res).toEqual({ items: [{ id: "X" }], total: 1 });
  });

  //
  // NEW TESTS to cover listByFormPaged
  //
  it("listByFormPaged throws if formKey missing", async () => {
    await expect(ResponseService.listByFormPaged()).rejects.toThrow(
      "formKey is required"
    );
  });

  it("listByFormPaged builds URL with default pagination and no q", async () => {
    apiFetch.mockResolvedValue({ items: [], total: 0 });

    const res = await ResponseService.listByFormPaged("FORM1");

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/Response/form/FORM1/responses?page=1&pageSize=20"
    );
    expect(res).toEqual({ items: [], total: 0 });
  });

  it("listByFormPaged encodes formKey and includes trimmed q", async () => {
    apiFetch.mockResolvedValue({ items: [{ id: 7 }], total: 7 });

    const res = await ResponseService.listByFormPaged("F K/4", {
      page: 3,
      pageSize: 5,
      q: "  search  ",
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/Response/form/F%20K%2F4/responses?page=3&pageSize=5&q=search"
    );
    expect(res).toEqual({ items: [{ id: 7 }], total: 7 });
  });
});