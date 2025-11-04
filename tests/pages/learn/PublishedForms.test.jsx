import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

// mock API
vi.mock("@src/api/forms", () => ({
  getPublishedForms: vi.fn(),
}));

// silence css import inside component
vi.mock("@src/pages/learn/learn.css", () => ({}), { virtual: true });

import PublishedForms from "@src/pages/learn/PublishedForms";
import { getPublishedForms } from "@src/api/forms";

function LocationSpy() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderWithRouter(ui) {
  return render(
    <MemoryRouter initialEntries={["/learn"]}>
      {ui}
      <LocationSpy />
    </MemoryRouter>
  );
}

describe("PublishedForms", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loader and then renders only Published cards", async () => {
    getPublishedForms.mockResolvedValue([
      { formKey: 1, title: "Alpha", description: "A", status: "Published", publishedAt: "2024-01-01T00:00:00Z" },
      { formKey: 2, title: "Beta", description: "B", status: "Draft",     publishedAt: "2024-02-01T00:00:00Z" },
      { FormKey: 3, Title: "Gamma", Description: "C", Status: "Published", PublishedAt: "2024-03-05T00:00:00Z" },
    ]);

    renderWithRouter(<PublishedForms />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    // banner/tabs exist
    expect(screen.getByText("Available Training Request")).toBeInTheDocument();
    expect(screen.getByText("Form List")).toBeInTheDocument();
  });

  it("supports API returning { items / Items } shapes", async () => {
    getPublishedForms.mockResolvedValue({ Items: [
      { FormKey: 10, Title: "WithItems", Description: "desc", Status: "Published", PublishedAt: "2024-04-01T00:00:00Z" },
    ]});

    renderWithRouter(<PublishedForms />);
    expect(await screen.findByText("WithItems")).toBeInTheDocument();
  });

  it("shows empty state when no published items", async () => {
    getPublishedForms.mockResolvedValue([{ title: "X", status: "Draft", formKey: 9 }]);
    renderWithRouter(<PublishedForms />);
    expect(await screen.findByText(/No published forms found/i)).toBeInTheDocument();
  });

  it("handles API errors (shows error.message)", async () => {
    getPublishedForms.mockRejectedValue(new Error("boom"));
    renderWithRouter(<PublishedForms />);
    // component renders e.message, not fallback string
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  it("filters by search query (title/description, case-insensitive)", async () => {
    getPublishedForms.mockResolvedValue([
      { formKey: 1, title: "React Basics", description: "Intro course", status: "Published" },
      { formKey: 2, title: "Docker 101", description: "containers", status: "Published" },
      { formKey: 3, title: "Advanced SQL", description: "joins & windows", status: "Published" },
    ]);

    renderWithRouter(<PublishedForms />);

    await screen.findByText("React Basics");
    const search = screen.getByPlaceholderText("Search");

    fireEvent.change(search, { target: { value: "dock" } });
    expect(screen.queryByText("React Basics")).not.toBeInTheDocument();
    expect(screen.getByText("Docker 101")).toBeInTheDocument();
    expect(screen.queryByText("Advanced SQL")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "INTRO" } }); // case-insensitive
    expect(screen.getByText("React Basics")).toBeInTheDocument();
    expect(screen.queryByText("Docker 101")).not.toBeInTheDocument();
  });

  it("navigates to learner submission on button click", async () => {
    getPublishedForms.mockResolvedValue([{ formKey: 77, title: "Kubernetes", status: "Published" }]);

    renderWithRouter(<PublishedForms />);

    await screen.findByText("Kubernetes");
    const btn = screen.getByRole("button", { name: /Start Submission/i });
    btn.click();

    await waitFor(() => {
      expect(screen.getByTestId("loc").textContent).toBe("/learn/forms/77");
    });
  });

  it("shows '—' for invalid or missing date", async () => {
    getPublishedForms.mockResolvedValue([
      { formKey: 1, title: "NoDate", status: "Published", publishedAt: null },
      { formKey: 2, title: "BadDate", status: "Published", publishedAt: "not-a-date" },
    ]);

    renderWithRouter(<PublishedForms />);

    await screen.findByText("NoDate");
    expect(screen.getAllByText("—").length).toBeGreaterThan(1);
  });
});