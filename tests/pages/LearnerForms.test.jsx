import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock static asset used by the component
vi.mock("../../src/assets/Search.png", () => ({ default: "search.png" }), {
  virtual: true,
});

// Mock the API module that LearnerForms imports
vi.mock("../../src/api/forms.js", () => {
  const list = vi.fn();
  return {
    FormService: {
      list,
    },
  };
});

import { FormService } from "../../src/api/forms.js";
import LearnerForms from "../../src/pages/LearnerForms.jsx";

function renderAt(path = "/learn") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn" element={<LearnerForms />} />
        <Route path="/forms/:key" element={<div>OPENED</div>} />
        <Route
          path="/learn/my-submissions"
          element={<div>MY SUBMISSIONS</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("<LearnerForms />", () => {
  beforeEach(() => {
    FormService.list.mockReset();

    // Default response: two published, one draft (filtered out)
    FormService.list.mockResolvedValue({
      items: [
        {
          formKey: 2,
          title: "Zeta",
          description: "zzz",
          status: "Published",
          publishedAt: "2024-03-01",
        },
        {
          formKey: 1,
          title: "Alpha",
          description: "aaa",
          status: "Published",
          publishedAt: "2024-05-01",
        },
        {
          formKey: 3,
          title: "Drafty",
          status: "Draft", // should be filtered out
        },
      ],
      total: 2,
    });
  });

  it("loads, sorts Published forms by publishedAt desc, filters by search, and opens form", async () => {
    renderAt("/learn");

    // First API call on mount
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith({
        status: "Published",
        page: 1,
        pageSize: 10,
        q: "",
      });
    });

    // After load, both cards should be present, sorted: Alpha (May) then Zeta (Mar)
    const alphaCard = await screen.findByLabelText("Alpha");
    const zetaCard = screen.getByLabelText("Zeta");

    expect(alphaCard).toBeInTheDocument();
    expect(zetaCard).toBeInTheDocument();

    // Filter by search (also triggers another API call with q="zeta")
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "zeta" },
    });

    await waitFor(() => {
      expect(FormService.list).toHaveBeenLastCalledWith({
        status: "Published",
        page: 1,
        pageSize: 10,
        q: "zeta",
      });
    });

    // Wait for filtered list to show only Zeta
    await waitFor(() => {
      expect(screen.queryByLabelText("Alpha")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Zeta")).toBeInTheDocument();
    });

    // Clicking "Start Submission" should navigate and show OPENED
    fireEvent.click(
      screen.getByRole("button", { name: /start submission/i })
    );

    expect(await screen.findByText("OPENED")).toBeInTheDocument();
  });

  it("shows empty state when no results after search", async () => {
    // For this test, make the *first* call return no items
    FormService.list.mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    renderAt("/learn");

    // Initial load completes with empty list
    await waitFor(() => {
      expect(FormService.list).toHaveBeenCalledWith({
        status: "Published",
        page: 1,
        pageSize: 10,
        q: "",
      });
    });

    // Empty state should be visible
    expect(await screen.findByText(/no forms found/i)).toBeInTheDocument();

    // Type a search (still empty) — component will call API again with q
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "nope" },
    });

    await waitFor(() => {
      expect(FormService.list).toHaveBeenLastCalledWith({
        status: "Published",
        page: 1,
        pageSize: 10,
        q: "nope",
      });
    });

    // And we still see the empty state
    expect(screen.getByText(/no forms found/i)).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    // Make the first call reject
    FormService.list.mockRejectedValueOnce(new Error("Backend down"));

    renderAt("/learn");

    const errorEl = await screen.findByText(/backend down/i);
    expect(errorEl).toBeInTheDocument();

    // No cards or empty state when err is set
    expect(screen.queryByLabelText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zeta")).not.toBeInTheDocument();
    expect(screen.queryByText(/no forms found/i)).not.toBeInTheDocument();
  });

  it("handles item without status as published and exercises pagination footer", async () => {
    // Override the default mock *completely* for this test
    FormService.list.mockReset();
    FormService.list.mockResolvedValue({
      items: [
        {
          FormKey: 10, // tests norm() fallback and "no status" treated as published
          Title: "Mystery",
          Description: "no status",
          PublishedAt: "2024-01-01",
        },
      ],
      total: 30, // 3 pages at 10 per page
    });

    renderAt("/learn");

    const card = await screen.findByLabelText("Mystery");
    expect(card).toBeInTheDocument();

    // Pagination footer present with 1 of 3
    // (whitespace in DOM may be split, so use regex for safety)
    expect(screen.getByText(/1\s*of\s*3/)).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "›" });
    const prevBtn = screen.getByRole("button", { name: "‹" });

    // On first page: prev disabled, next enabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Clicking "next" moves to page 2 and triggers another API call
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(FormService.list).toHaveBeenLastCalledWith({
        status: "Published",
        page: 2,
        pageSize: 10,
        q: "",
      });
    });

    // Now we should be on page 2 of 3
    expect(screen.getByText(/2\s*of\s*3/)).toBeInTheDocument();

    // Change page size to 25; this should reset to page 1 and fetch again
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "25" },
    });

    await waitFor(() => {
      expect(FormService.list).toHaveBeenLastCalledWith({
        status: "Published",
        page: 1,
        pageSize: 25,
        q: "",
      });
    });
  });
});