// ✅ tests/pages/AdminDashboard.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

//
// 🔹 Global mocks
//

// track navigation calls
const mockNavigate = vi.fn();

// mock react-router-dom's useNavigate (we don't need a real Router)
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// mock AdminFormCard so we can drive callbacks easily and inspect props
vi.mock("@src/components/AdminFormCard", () => ({
  default: ({ form, onView, onConfig, onEdit, onClone, onDelete }) => (
    <div data-testid={`card-${form.id}`}>
      <span data-testid={`title-${form.id}`}>{form.title}</span>
      <span data-testid={`status-${form.id}`}>{form.status}</span>
      <div data-testid={`meta-${form.id}`}>
        {(form.meta || []).map((m) => `${m.k}:${m.v}`).join("|")}
      </div>
      <button data-testid={`view-${form.id}`} onClick={onView}>View</button>
      <button data-testid={`config-${form.id}`} onClick={onConfig}>Config</button>
      <button data-testid={`edit-${form.id}`} onClick={onEdit}>Edit</button>
      <button data-testid={`clone-${form.id}`} onClick={onClone}>Clone</button>
      <button data-testid={`delete-${form.id}`} onClick={onDelete}>Delete</button>
    </div>
  ),
}));

// mock API services
vi.mock("@src/api/forms", () => ({
  FormService: {
    list: vi.fn(),
    clone: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@src/api/auth", () => ({
  AuthService: {
    isAuthenticated: vi.fn(),
  },
}));

// handy access to mocks
const { FormService } = await import("@src/api/forms");
const { AuthService } = await import("@src/api/auth");

//
// 🔹 Safe localStorage mock (JSDOM-safe)
//

const localStore = {};
const setItemSpy = vi.fn((key, value) => { localStore[key] = String(value); });
const getItemSpy = vi.fn((key) => (key in localStore ? localStore[key] : null));
const removeItemSpy = vi.fn((key) => { delete localStore[key]; });
const clearSpy = vi.fn(() => { for (const k in localStore) delete localStore[k]; });

Object.defineProperty(window, "localStorage", {
  value: { setItem: setItemSpy, getItem: getItemSpy, removeItem: removeItemSpy, clear: clearSpy },
  writable: true,
});

//
// 🔹 Tests
//
describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    for (const k in localStore) delete localStore[k];
  });

  async function renderDashboard() {
    const { default: AdminDashboard } = await import("@src/pages/AdminDashboard.jsx");
    return render(<AdminDashboard />);
  }

  it("shows unauthenticated banner and sign-in flow when not authenticated", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    FormService.list.mockResolvedValue({ items: [] });

    await renderDashboard();

    expect(await screen.findByText(/You are not authenticated \(401\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to view forms\./i)).toBeInTheDocument();

    const search = screen.getByPlaceholderText("Search");
    expect(search).toBeDisabled();

    const signInBtn = screen.getByRole("button", { name: /Sign in/i });
    fireEvent.click(signInBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/login", { state: { from: "/" } });
  });

  it("loads forms from API when authenticated and maps fields correctly", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({
      items: [
        {
          formKey: "k1",
          title: "First Form",
          status: "Published",
          createdAt: "2024-01-01T00:00:00Z",
          createdByName: "Alice",
          publishedAt: "2024-01-02T00:00:00Z",
        },
        {
          FormKey: "k2",
          Title: "Second Form",
          Status: "Draft",
          created_on: "2024-01-03T00:00:00Z",
          createdBy: 0,
        },
      ],
      total: 2
    });

    await renderDashboard();

    const card1 = await screen.findByTestId("card-k1");
    const card2 = screen.getByTestId("card-k2");
    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
    expect(screen.getByTestId("title-k1").textContent).toBe("First Form");
    expect(screen.getByTestId("meta-k2").textContent).toMatch(/Created By:Admin/);
  });

  it("handles different API response formats correctly", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue([
      {
        key: "k3",
        title: "Third Form",
        status: "Published",
        createdAt: "2024-01-01T00:00:00Z",
        ownerName: "Bob",
      },
      {
        key: "k4",
        title: "Fourth Form",
        status: "Draft",
        createdAt: "2024-01-03T00:00:00Z",
        ownerEmail: "user@example.com",
      },
      {
        key: "k5",
        // No title
        status: "Draft",
        createdAt: "2024-01-03T00:00:00Z",
        OwnerName: "",
      }
    ]);

    await renderDashboard();

    const card3 = await screen.findByTestId("card-k3");
    const card4 = screen.getByTestId("card-k4");
    const card5 = screen.getByTestId("card-k5");
    
    expect(card3).toBeInTheDocument();
    expect(card4).toBeInTheDocument();
    expect(card5).toBeInTheDocument();
    
    expect(screen.getByTestId("title-k3").textContent).toBe("Third Form");
    expect(screen.getByTestId("meta-k3").textContent).toMatch(/Created By:Bob/);
    
    expect(screen.getByTestId("title-k4").textContent).toBe("Fourth Form");
    expect(screen.getByTestId("meta-k4").textContent).toMatch(/Created By:user@example.com/);
    
    expect(screen.getByTestId("title-k5").textContent).toBe("Untitled Form");
    expect(screen.getByTestId("meta-k5").textContent).toMatch(/Created By:Admin/);
  });

  it("handles Items/Total capitalization in API response", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({
      Items: [
        { formKey: "i1", title: "Item Form 1" },
        { formKey: "i2", title: "Item Form 2" }
      ],
      Total: 2
    });

    await renderDashboard();

    const card1 = await screen.findByTestId("card-i1");
    const card2 = screen.getByTestId("card-i2");
    
    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
  });

  it("filters forms by search query", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({
      items: [
        { formKey: "a", title: "React Basics" },
        { formKey: "b", title: "Docker 101" },
      ],
    });

    await renderDashboard();
    await screen.findByTestId("card-a");

    const search = screen.getByPlaceholderText("Search");
    fireEvent.change(search, { target: { value: "docker" } });

    // Wait for the API call with the search term
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith(expect.objectContaining({ q: "docker" }));
    });
  });

  it("handles Unauthorized API error by showing login prompt", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockRejectedValue(new Error("401 Unauthorized"));

    await renderDashboard();

    expect(await screen.findByText(/You are not authenticated \(401\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to view forms\./i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search")).toBeDisabled();
  });

  it("handles Forbidden API error by showing login prompt", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockRejectedValue(new Error("403 Forbidden"));

    await renderDashboard();

    expect(await screen.findByText(/You are not authenticated \(401\)/i)).toBeInTheDocument();
  });

  it("falls back to local drafts when API fails with non-auth error", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    const draft = { id: 1, title: "Local Draft", status: "Draft", createdAt: "2024-05-01T00:00:00Z", createdBy: "LocalUser" };
    window.localStorage.setItem("fb_forms", JSON.stringify([draft]));
    FormService.list.mockRejectedValue(new Error("Network down"));

    await renderDashboard();

    expect(await screen.findByText(/API not reachable — showing local drafts/i)).toBeInTheDocument();
    expect(await screen.findByTestId("card-1")).toBeInTheDocument();
    expect(getItemSpy).toHaveBeenCalledWith("fb_forms");
  });

  it("handles empty or invalid localStorage data", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    window.localStorage.setItem("fb_forms", "invalid json");
    FormService.list.mockRejectedValue(new Error("Network down"));

    await renderDashboard();

    expect(await screen.findByText(/API not reachable — showing local drafts/i)).toBeInTheDocument();
    expect(screen.getByText(/No forms found\./i)).toBeInTheDocument();
  });

  it("navigates correctly from Create Form button", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [] });

    await renderDashboard();

    const btn = await screen.findByRole("button", { name: /Create Form/i });
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith("/create-form", { state: { tab: "config" } });
  });

  it("navigates to responses/config/editor for API forms via card actions", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "abc123", title: "API Form" }] });

    await renderDashboard();
    await screen.findByTestId("card-abc123");

    fireEvent.click(screen.getByTestId("view-abc123"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/forms/abc123?tab=responses");

    fireEvent.click(screen.getByTestId("config-abc123"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/forms/abc123?tab=config");

    fireEvent.click(screen.getByTestId("edit-abc123"));
    expect(mockNavigate).toHaveBeenCalledWith("/create-form", {
      state: { tab: "layout", formKey: "abc123" },
    });
  });

  it("shows alert and does not navigate when viewing local draft", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    const draft = { id: 10, title: "Offline Draft", status: "Draft", createdBy: "LocalUser" };
    window.localStorage.setItem("fb_forms", JSON.stringify([draft]));
    FormService.list.mockRejectedValue(new Error("Network down"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    await renderDashboard();
    await screen.findByTestId("card-10");

    fireEvent.click(screen.getByTestId("view-10"));
    fireEvent.click(screen.getByTestId("config-10"));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clones API form via FormService.clone and prepends copy", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "orig", title: "Original" }] });
    FormService.clone.mockResolvedValue({ formKey: "cloned-key" });

    await renderDashboard();
    await screen.findByTestId("card-orig");

    fireEvent.click(screen.getByTestId("clone-orig"));

    await waitFor(() => {
      expect(screen.getByText("Original (Copy)")).toBeInTheDocument();
    });
  });

  it("handles clone API returning incomplete data", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "orig3", title: "Original 3" }] });
    FormService.clone.mockResolvedValue({}); // No formKey returned

    await renderDashboard();
    await screen.findByTestId("card-orig3");

    fireEvent.click(screen.getByTestId("clone-orig3"));

    await waitFor(() => {
      expect(screen.getByText("Original 3 (Copy)")).toBeInTheDocument();
      const newCardId = screen.getByText("Original 3 (Copy)").closest("div").getAttribute("data-testid");
      expect(newCardId).toContain("orig3-copy");
    });
  });

  it("falls back to local clone when API clone fails", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "orig2", title: "Form2" }] });
    FormService.clone.mockRejectedValue(new Error("clone API down"));

    await renderDashboard();
    await screen.findByTestId("card-orig2");

    fireEvent.click(screen.getByTestId("clone-orig2"));

    await waitFor(() => {
      expect(screen.getByText("Form2 (Copy)")).toBeInTheDocument();
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      "fb_forms",
      expect.stringContaining("Form2 (Copy)")
    );
  });

  it("clones local draft form correctly", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    const draft = { id: 20, title: "Local Form", status: "Draft" };
    window.localStorage.setItem("fb_forms", JSON.stringify([draft]));
    FormService.list.mockRejectedValue(new Error("Network down"));

    await renderDashboard();
    await screen.findByTestId("card-20");

    fireEvent.click(screen.getByTestId("clone-20"));

    await waitFor(() => {
      expect(screen.getByText("Local Form (Copy)")).toBeInTheDocument();
    });
    
    expect(setItemSpy).toHaveBeenCalledWith(
      "fb_forms",
      expect.stringContaining("Local Form (Copy)")
    );
  });

  it("does not delete when user cancels confirm()", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "del1", title: "To Delete" }] });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    await renderDashboard();
    await screen.findByTestId("card-del1");

    fireEvent.click(screen.getByTestId("delete-del1"));
    expect(FormService.remove).not.toHaveBeenCalled();
    expect(screen.getByTestId("card-del1")).toBeInTheDocument();
  });

  it("deletes API form and calls FormService.remove", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "del2", title: "To Delete 2" }] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    FormService.remove.mockResolvedValue();

    await renderDashboard();
    await screen.findByTestId("card-del2");

    fireEvent.click(screen.getByTestId("delete-del2"));
    await waitFor(() => {
      expect(screen.queryByTestId("card-del2")).not.toBeInTheDocument();
    });
    expect(FormService.remove).toHaveBeenCalledWith("del2");
  });

  it("handles API delete failure gracefully", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "del3", title: "To Delete 3" }] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    FormService.remove.mockRejectedValue(new Error("Delete failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await renderDashboard();
    await screen.findByTestId("card-del3");

    fireEvent.click(screen.getByTestId("delete-del3"));
    await waitFor(() => {
      expect(screen.queryByTestId("card-del3")).not.toBeInTheDocument();
    });
    expect(FormService.remove).toHaveBeenCalledWith("del3");
    expect(console.warn).toHaveBeenCalled();
  });

  it("deletes local draft and updates localStorage", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    const draft = { id: 999, title: "Local To Delete", status: "Draft", createdBy: "LocalUser" };
    window.localStorage.setItem("fb_forms", JSON.stringify([draft]));
    FormService.list.mockRejectedValue(new Error("Network down"));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await renderDashboard();
    await screen.findByTestId("card-999");

    fireEvent.click(screen.getByTestId("delete-999"));
    await waitFor(() => {
      expect(screen.queryByTestId("card-999")).not.toBeInTheDocument();
    });
    expect(setItemSpy).toHaveBeenCalledWith("fb_forms", "[]");
  });

  it("handles pagination correctly", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({
      items: [{ formKey: "p1", title: "Page 1 Item" }],
      total: 25
    });

    await renderDashboard();
    await screen.findByTestId("card-p1");

    // Test next page
    const nextButton = screen.getByText("›");
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });

    // Test previous page
    const prevButton = screen.getByText("‹");
    fireEvent.click(prevButton);
    
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });

    // Test changing page size
    const pageSizeSelect = screen.getByText("10").closest("select");
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });
    
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith(expect.objectContaining({ 
        pageSize: 25,
        page: 1 // Should reset to page 1
      }));
    });
  });

  it("handles pagination with local forms correctly", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    // Create 15 local forms to test pagination
    const localForms = Array.from({ length: 15 }, (_, i) => ({
      id: i + 100,
      title: `Local Form ${i + 1}`,
      status: "Draft"
    }));
    window.localStorage.setItem("fb_forms", JSON.stringify(localForms));
    FormService.list.mockRejectedValue(new Error("Network down"));

    await renderDashboard();
    
    // Should show first 10 items by default
    expect(await screen.findByTestId("card-100")).toBeInTheDocument();
    expect(screen.queryByTestId("card-110")).not.toBeInTheDocument();
    
    // Go to next page
    const nextButton = screen.getByText("›");
    fireEvent.click(nextButton);
    
    // Should show remaining 5 items
    await waitFor(() => {
      expect(screen.queryByTestId("card-100")).not.toBeInTheDocument();
      expect(screen.getByTestId("card-110")).toBeInTheDocument();
    });
    
    // Change page size to 25
    const pageSizeSelect = screen.getByText("10").closest("select");
    fireEvent.change(pageSizeSelect, { target: { value: "25" } });
    
    // Should show all items on one page
    await waitFor(() => {
      expect(screen.getByTestId("card-100")).toBeInTheDocument();
      expect(screen.getByTestId("card-114")).toBeInTheDocument();
    });
  });

  it("handles search with local forms correctly", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    const localForms = [
      { id: 201, title: "Apple Form", status: "Draft" },
      { id: 202, title: "Banana Form", status: "Draft" },
      { id: 203, title: "Cherry Form", status: "Draft" }
    ];
    window.localStorage.setItem("fb_forms", JSON.stringify(localForms));
    FormService.list.mockRejectedValue(new Error("Network down"));

    await renderDashboard();
    await screen.findByTestId("card-201");
    
    const search = screen.getByPlaceholderText("Search");
    fireEvent.change(search, { target: { value: "banana" } });
    
    await waitFor(() => {
      expect(screen.queryByTestId("card-201")).not.toBeInTheDocument();
      expect(screen.getByTestId("card-202")).toBeInTheDocument();
      expect(screen.queryByTestId("card-203")).not.toBeInTheDocument();
    });
  });

  it("shows loading skeleton while fetching data", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    // Delay the API response to ensure we see the loading state
    FormService.list.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ items: [] }), 100);
    }));

    const { container } = await renderDashboard();
    
    // Should show skeletons while loading
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(container.querySelectorAll('.skeleton').length).toBe(0);
    });
  });

  it("shows empty state when no forms are found", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [], total: 0 });

    await renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText("No forms found.")).toBeInTheDocument();
    });
  });

  it("resets component state when unmounted", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockResolvedValue({ items: [{ formKey: "test", title: "Test Form" }] });

    const { unmount } = await renderDashboard();
    await screen.findByTestId("card-test");
    
    // Unmount the component
    unmount();
    
    // Render again with different data
    FormService.list.mockResolvedValue({ items: [{ formKey: "new", title: "New Form" }] });
    await renderDashboard();
    
    // Should show new data without interference from previous render
    await screen.findByTestId("card-new");
    expect(screen.queryByTestId("card-test")).not.toBeInTheDocument();
  });
});
