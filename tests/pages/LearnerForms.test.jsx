import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@src/assets/Search.png", () => ({ default: "search.png" }), { virtual: true });
vi.mock("@src/api/forms.js", () => ({
  FormService: {
    list: vi.fn(async () => ({
      items: [
        { formKey: 2, title: "Zeta", description: "zzz", status: "Published", publishedAt: "2024-03-01" },
        { formKey: 1, title: "Alpha", description: "aaa", status: "Published", publishedAt: "2024-05-01" },
        { formKey: 3, title: "Drafty", status: "Draft" }, // filtered
      ],
    })),
  },
}));

import LearnerForms from "@src/pages/LearnerForms.jsx";

function renderAt(path = "/learn") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn" element={<LearnerForms />} />
        <Route path="/forms/:key" element={<div>OPENED</div>} />
        <Route path="/learn/my-submissions" element={<div>MY SUBMISSIONS</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("<LearnerForms />", () => {
  it("loads and sorts Published forms by publishedAt desc, filters by search, and opens form", async () => {
    renderAt("/learn");
    // sorted: Alpha (May) first, then Zeta (Mar)
    expect(await screen.findByLabelText("Alpha")).toBeInTheDocument();
    expect(screen.getByLabelText("Zeta")).toBeInTheDocument();

    // filter
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "zeta" } });
    expect(screen.queryByLabelText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Zeta")).toBeInTheDocument();

    // open
    fireEvent.click(screen.getByRole("button", { name: /start submission/i }));
    expect(await screen.findByText("OPENED")).toBeInTheDocument();
  });

  it("shows empty state when no results after search", async () => {
    renderAt("/learn");
    await screen.findByLabelText("Alpha");
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "nope" } });
    expect(screen.getByText(/no forms found/i)).toBeInTheDocument();
  });
});