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
    });

    await renderDashboard();

    const card1 = await screen.findByTestId("card-k1");
    const card2 = screen.getByTestId("card-k2");
    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
    expect(screen.getByTestId("title-k1").textContent).toBe("First Form");
    expect(screen.getByTestId("meta-k2").textContent).toMatch(/Created By:Admin/);
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

    expect(screen.queryByTestId("card-a")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-b")).toBeInTheDocument();
  });

  it("handles Unauthorized API error by showing login prompt", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    FormService.list.mockRejectedValue(new Error("401 Unauthorized"));

    await renderDashboard();

    expect(await screen.findByText(/You are not authenticated \(401\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to view forms\./i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search")).toBeDisabled();
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
});
