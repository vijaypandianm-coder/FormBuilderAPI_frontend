// Re-import fresh each time to reset the in-module `db`
const importFresh = async () => {
  vi.resetModules();
  return await import("@src/mock/forms.mock.impl.js"); // ← your path
};

describe("forms.mock.impl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("mockList returns paginated items with total, page, pageSize", async () => {
    const { mockList } = await importFresh();

    const page1 = await mockList({ page: 1, pageSize: 2, status: undefined });
    expect(page1.total).toBe(6);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(2);
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].title).toBe("Post-Course Experience");

    const page2 = await mockList({ page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0].title).toBe("Learning Path Design"); // 3rd overall
  });

  it("mockList filters by status (case-insensitive)", async () => {
    const { mockList } = await importFresh();

    const published = await mockList({ page: 1, pageSize: 10, status: "published" });
    expect(published.total).toBe(4);
    expect(published.items.every(i => i.status === "Published")).toBe(true);

    const drafts = await mockList({ page: 1, pageSize: 10, status: "DRAFT" });
    expect(drafts.total).toBe(2);
    expect(drafts.items.every(i => i.status === "Draft")).toBe(true);
  });

  it("mockToggleStatus updates status", async () => {
    const mod = await importFresh();
    const { mockList, mockToggleStatus } = mod;

    const pre = await mockList({ page: 1, pageSize: 10 });
    const target = pre.items.find(i => i.formKey === 103);
    expect(target.status).toBe("Draft");

    const r = await mockToggleStatus(103, "Published");
    expect(r).toEqual({ formKey: 103, status: "Published" });

    const post = await mockList({ page: 1, pageSize: 10 });
    const updated = post.items.find(i => i.formKey === 103);
    expect(updated.status).toBe("Published");
  });

  it("mockSetAccess returns { formKey, access }", async () => {
    const { mockSetAccess } = await importFresh();
    const r = await mockSetAccess(104, "Open");
    expect(r).toEqual({ formKey: 104, access: "Open" });
  });

  it("mockClone clones deterministically and unshifts", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1714410000000); // deterministic
    vi.spyOn(Math, "random").mockReturnValue(0.234);      // → 3106

    const mod = await importFresh();
    const { mockList, mockClone } = mod;

    const before = await mockList({ page: 1, pageSize: 10 });
    expect(before.total).toBe(6);

    const copy = await mockClone(102); // Employee Onboarding
    expect(copy.title).toBe("Employee Onboarding (Copy)");
    expect(copy.formKey).toBe(3106);
    expect(copy.id).toBe("copy-1714410000000");

    const after = await mockList({ page: 1, pageSize: 10 });
    expect(after.total).toBe(7);
    expect(after.items[0].title).toBe("Employee Onboarding (Copy)");
  });

  it("mockDelete removes by formKey", async () => {
    const mod = await importFresh();
    const { mockList, mockDelete } = mod;

    const pre = await mockList({ page: 1, pageSize: 20 });
    expect(pre.total).toBe(6);

    const r = await mockDelete(105);
    expect(r).toEqual({ formKey: 105 });

    const post = await mockList({ page: 1, pageSize: 20 });
    expect(post.total).toBe(5);
    expect(post.items.some(i => i.formKey === 105)).toBe(false);
  });

  it("mockList handles empty pages", async () => {
    const { mockList } = await importFresh();
    const last = await mockList({ page: 3, pageSize: 2 });
    expect(last.items.length).toBe(2);
    const beyond = await mockList({ page: 4, pageSize: 2 });
    expect(beyond.items.length).toBe(0);
  });
});