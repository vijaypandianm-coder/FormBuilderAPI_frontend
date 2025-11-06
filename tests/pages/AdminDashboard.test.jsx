// tests/pages/AdminDashboard.test.jsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------- Mocks ----------

let mockNavigate;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../src/components/AdminFormCard.jsx", () => ({
  default: ({ form, onView, onConfig, onEdit, onClone, onDelete }) => (
    <div data-testid={`card-${form.id}`}>
      <div>{form.title}</div>
      <button onClick={onView}>view</button>
      <button onClick={onConfig}>config</button>
      <button onClick={onEdit}>edit</button>
      <button onClick={onClone}>clone</button>
      <button onClick={onDelete}>delete</button>
    </div>
  ),
}));

vi.mock("../../src/components/ConfirmDialog.jsx", () => ({
  default: ({ open, title, body, onCancel, onConfirm }) => {
    if (!open) return null;
    return (
      <div data-testid={`dialog-${title}`}>
        <div>{title}</div>
        <div>{body}</div>
        <button onClick={onCancel}>cancel</button>
        <button onClick={onConfirm}>confirm</button>
      </div>
    );
  },
}));

vi.mock("../../src/api/http", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../../src/api/auth", () => ({
  AuthService: {
    isAuthenticated: vi.fn(),
    getToken: vi.fn(),
  },
}));

vi.mock("../../src/api/forms", () => ({
  FormService: {
    remove: vi.fn(),
    clone: vi.fn(),
    updateMeta: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

// ---------- Imports after mocks ----------
import AdminDashboard from "../../src/pages/AdminDashboard.jsx";
import { apiFetch } from "../../src/api/http";
import { AuthService } from "../../src/api/auth";
import { FormService } from "../../src/api/forms";

const flushPromises = () => new Promise((res) => setTimeout(res, 0));

describe("<AdminDashboard />", () => {
  let alertSpy;
  let warnSpy;

  beforeEach(() => {
    mockNavigate = vi.fn();
    localStorage.clear();
    vi.clearAllMocks();
    AuthService.isAuthenticated.mockReturnValue(true);
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    warnSpy.mockRestore();
  });

  const makeApiOkOnce = (items = [], total = undefined) => {
    apiFetch.mockResolvedValueOnce({
      items,
      total: total ?? items.length,
    });
  };

  it("renders API forms, supports search, pagination, and Create Form navigation", async () => {
    const forms = [
      {
        formKey: "F1",
        title: "First Form",
        status: "Draft",
        createdAt: new Date().toISOString(),
        createdByName: "Alice",
      },
      {
        formKey: "F2",
        title: "Second Form",
        status: "Published",
        createdAt: new Date().toISOString(),
        createdByName: "Bob",
      },
    ];

    // 1) Initial load: both forms
    // 2) After pageSize change: both forms again
    // 3) After search=q "second": only Second Form
    apiFetch
      .mockResolvedValueOnce({ items: forms, total: 2 })
      .mockResolvedValueOnce({ items: forms, total: 2 })
      .mockResolvedValueOnce({ items: [forms[1]], total: 1 });

    render(<AdminDashboard />);

    // wait until first data load happens
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/Admin/forms?")
      )
    );

    // The two cards should be present initially
    await waitFor(() => {
      expect(screen.getByText("First Form")).toBeInTheDocument();
      expect(screen.getByText("Second Form")).toBeInTheDocument();
    });

    // pagination text uses server total
    expect(screen.getByText("1 of 1")).toBeInTheDocument();

    // change items per page (triggers second apiFetch call)
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "25" },
    });

    // Just ensure the second call occurred; we don't care about DOM effect here
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    // search filters; this triggers the 3rd apiFetch with &search=second
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "second" },
    });

    await waitFor(() => {
      // Only "Second Form" should remain visible
      expect(screen.queryByText("First Form")).not.toBeInTheDocument();
      expect(screen.getByText("Second Form")).toBeInTheDocument();
    });

    // Create Form button
    fireEvent.click(screen.getByText("Create Form"));
    expect(mockNavigate).toHaveBeenCalledWith("/create-form", {
      state: { tab: "config" },
    });
  });

  it("shows not-authenticated banner when AuthService returns false and sign-in navigates", async () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    apiFetch.mockReset(); // shouldn't be called

    render(<AdminDashboard />);

    expect(
      screen.getByText(/You are not authenticated \(401\)/i)
    ).toBeInTheDocument();

    const btn = screen.getByText("Sign in");
    fireEvent.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      state: { from: "/" },
    });
  });

  it("handles API auth error (401/403) by clearing forms and showing banner", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    apiFetch.mockRejectedValue(new Error("401 Unauthorized"));

    render(<AdminDashboard />);

    await flushPromises();

    expect(
      screen.getByText(/You are not authenticated \(401\)/i)
    ).toBeInTheDocument();
    // no cards, because forms cleared
    expect(screen.queryByTestId(/^card-/)).not.toBeInTheDocument();
  });

  it("falls back to local drafts when API fails with non-auth error", async () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    localStorage.setItem(
      "fb_forms",
      JSON.stringify([
        {
          id: "loc1",
          title: "Local Draft",
          status: "Draft",
          createdAt: new Date().toISOString(),
          createdBy: "Local Admin",
        },
      ])
    );
    apiFetch.mockRejectedValue(new Error("Network error"));

    render(<AdminDashboard />);

    await flushPromises();

    expect(
      screen.getByText(/API not reachable — showing local drafts/i)
    ).toBeInTheDocument();

    // local draft card
    expect(screen.getByText("Local Draft")).toBeInTheDocument();

    // view responses on local → alert branch
    fireEvent.click(screen.getByText("view"));
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("local draft")
    );

    // delete local draft → removes from localStorage
    fireEvent.click(screen.getByText("delete"));
    const dlg = await screen.findByTestId("dialog-Delete Form");
    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    const stored = JSON.parse(localStorage.getItem("fb_forms") || "[]");
    expect(stored).toHaveLength(0);
  });

  it("navigates to responses, config and editor for API forms", async () => {
    const forms = [
      {
        formKey: "APIKEY1",
        title: "API Form",
        status: "Draft",
        createdAt: new Date().toISOString(),
      },
    ];
    makeApiOkOnce(forms, 1);

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("API Form"));

    // view responses
    fireEvent.click(screen.getByText("view"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/admin/forms/APIKEY1?tab=responses"
    );

    mockNavigate.mockClear();

    // config view
    fireEvent.click(screen.getByText("config"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/admin/forms/APIKEY1?tab=config"
    );

    mockNavigate.mockClear();

    // edit (open builder layout)
    fireEvent.click(screen.getByText("edit"));
    expect(mockNavigate).toHaveBeenCalledWith("/create-form", {
      state: { tab: "layout", formKey: "APIKEY1" },
    });
  });

  it("handles clone for local drafts by showing alert", async () => {
    // force usingLocal mode via API fail
    AuthService.isAuthenticated.mockReturnValue(true);
    localStorage.setItem(
      "fb_forms",
      JSON.stringify([
        {
          id: "local-only",
          title: "Local Only Form",
          status: "Draft",
          createdAt: new Date().toISOString(),
          createdBy: "Admin",
        },
      ])
    );
    apiFetch.mockRejectedValue(new Error("Network error"));

    render(<AdminDashboard />);

    await flushPromises();

    // click clone on local draft
    fireEvent.click(screen.getByText("clone"));

    const dlg = await screen.findByTestId("dialog-Clone Form");

    // Confirm clone -> should alert because no formKey
    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("cannot be cloned")
    );
    expect(FormService.clone).not.toHaveBeenCalled();
  });

  it("clones API form via clone endpoint, renames and sets draft", async () => {
    const forms = [
      {
        formKey: "ORIGKEY",
        title: "Original Form",
        status: "Published",
        createdAt: new Date().toISOString(),
      },
    ];
    makeApiOkOnce(forms, 1);

    FormService.clone.mockResolvedValue({ formKey: "NEWKEY" });
    FormService.updateMeta.mockResolvedValue({});
    FormService.updateStatus.mockResolvedValue({});

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Original Form"));

    fireEvent.click(screen.getByText("clone"));

    const dlg = await screen.findByTestId("dialog-Clone Form");

    const input = dlg.querySelector(".clone-body-input");
    fireEvent.change(input, { target: { value: "My Clone" } });

    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(FormService.clone).toHaveBeenCalledWith("ORIGKEY");
    });

    // description is "", because AdminDashboard doesn't hold description on form object
    expect(FormService.updateMeta).toHaveBeenCalledWith("NEWKEY", {
      title: "My Clone",
      description: "",
      access: "Open",
    });
    expect(FormService.updateStatus).toHaveBeenCalledWith(
      "NEWKEY",
      "Draft"
    );
  });

  it("deletes API form via FormService.remove and removes from UI", async () => {
    const forms = [
      {
        formKey: "DELKEY",
        title: "Delete Me",
        status: "Draft",
        createdAt: new Date().toISOString(),
      },
    ];

    // First call: initial load (contains form)
    apiFetch.mockResolvedValueOnce({
      items: forms,
      total: 1,
    });
    // Second call: after delete & refreshTick (empty list)
    apiFetch.mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    FormService.remove.mockResolvedValue({});

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Delete Me"));

    fireEvent.click(screen.getByText("delete"));

    const dlg = await screen.findByTestId("dialog-Delete Form");
    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(FormService.remove).toHaveBeenCalledWith("DELKEY")
    );

    // after refresh, form should no longer be present
    await waitFor(() => {
      expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
    });
  });

  // ---------- Extra tests to hit remaining branches/lines ----------

  it("shows skeletons while loading before API resolves", () => {
    // Long pending promise so loading stays true
    apiFetch.mockReturnValue(new Promise(() => {}));

    render(<AdminDashboard />);

    // skeletons should be visible immediately
    const skels = screen.getAllByText((_, el) =>
      el.classList?.contains("skeleton")
    );
    expect(skels.length).toBeGreaterThan(0);
  });

  it("handles delete API failure by showing alert and keeping form", async () => {
    const forms = [
      {
        formKey: "FAILDEL",
        title: "Fail Delete",
        status: "Draft",
        createdAt: new Date().toISOString(),
      },
    ];

    makeApiOkOnce(forms, 1);
    FormService.remove.mockRejectedValue(new Error("boom"));

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Fail Delete"));

    fireEvent.click(screen.getByText("delete"));

    const dlg = await screen.findByTestId("dialog-Delete Form");
    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Failed to delete form.")
    );

    // Form should still be on screen
    expect(screen.getByText("Fail Delete")).toBeInTheDocument();
  });

  it("allows cancelling delete dialog without removing form", async () => {
    const forms = [
      {
        formKey: "CANCELDEL",
        title: "Cancel Delete",
        status: "Draft",
        createdAt: new Date().toISOString(),
      },
    ];

    makeApiOkOnce(forms, 1);
    FormService.remove.mockResolvedValue({});

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Cancel Delete"));

    fireEvent.click(screen.getByText("delete"));

    const dlg = await screen.findByTestId("dialog-Delete Form");
    const cancelBtn = dlg.querySelector("button:first-of-type");
    fireEvent.click(cancelBtn);

    expect(FormService.remove).not.toHaveBeenCalled();
    expect(screen.getByText("Cancel Delete")).toBeInTheDocument();
  });

  it("handles updateMeta failure when cloning but still proceeds", async () => {
    const forms = [
      {
        formKey: "CLONE1",
        title: "Clone Meta Fail",
        status: "Published",
        createdAt: new Date().toISOString(),
      },
    ];
    makeApiOkOnce(forms, 1);

    FormService.clone.mockResolvedValue({ formKey: "NEWKEY2" });
    FormService.updateMeta.mockRejectedValue(new Error("meta fail"));
    FormService.updateStatus.mockResolvedValue({});

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Clone Meta Fail"));

    fireEvent.click(screen.getByText("clone"));

    const dlg = await screen.findByTestId("dialog-Clone Form");
    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(FormService.clone).toHaveBeenCalledWith("CLONE1")
    );

    // updateMeta failure should be logged but not break clone flow
    expect(FormService.updateMeta).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Rename cloned form failed:"),
      expect.any(Error)
    );

    // updateStatus still called
    expect(FormService.updateStatus).toHaveBeenCalledWith(
      "NEWKEY2",
      "Draft"
    );
  });

  it("handles clone endpoint failure by alerting user", async () => {
    const forms = [
      {
        formKey: "CLONEFAIL",
        title: "Clone Fails",
        status: "Draft",
        createdAt: new Date().toISOString(),
      },
    ];
    makeApiOkOnce(forms, 1);

    FormService.clone.mockRejectedValue(new Error("clone boom"));

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Clone Fails"));

    fireEvent.click(screen.getByText("clone"));

    const dlg = await screen.findByTestId("dialog-Clone Form");
    const confirmBtn = dlg.querySelector("button:last-of-type");
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Failed to clone form. Please try again."
      )
    );

    // updateMeta/updateStatus should not be called
    expect(FormService.updateMeta).not.toHaveBeenCalled();
    expect(FormService.updateStatus).not.toHaveBeenCalled();
  });

  it("allows cancelling clone dialog without calling clone", async () => {
    const forms = [
      {
        formKey: "CANCELCLONE",
        title: "Cancel Clone",
        status: "Draft",
        createdAt: new Date().toISOString(),
      },
    ];
    makeApiOkOnce(forms, 1);

    FormService.clone.mockResolvedValue({ formKey: "WONTUSE" });

    render(<AdminDashboard />);

    await waitFor(() => screen.getByText("Cancel Clone"));

    fireEvent.click(screen.getByText("clone"));

    const dlg = await screen.findByTestId("dialog-Clone Form");
    const cancelBtn = dlg.querySelector("button:first-of-type");
    fireEvent.click(cancelBtn);

    expect(FormService.clone).not.toHaveBeenCalled();
    expect(screen.getByText("Cancel Clone")).toBeInTheDocument();
  });
});