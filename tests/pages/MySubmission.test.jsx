// tests/pages/MySubmissions.test.jsx
import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MySubmissions from "../../src/pages/MySubmissions.jsx";
import { vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../src/assets/ViewSub.png", () => ({ default: "view.png" }));
vi.mock("../../src/assets/Search.png", () => ({ default: "search.png" }));

vi.mock("../../src/api/responses", () => ({
  default: {
    listMy: vi.fn().mockResolvedValue([
      { responseId: 201, formKey: 55, submittedAt: "2025-10-10T10:00:00Z", status: "Completion Submitted" },
      { responseId: 202, formKey: 77, submittedAt: "2025-10-11T10:00:00Z", status: "Approved" },
    ]),
  },
}));

vi.mock("../../src/api/forms", () => ({
  FormService: {
    get: vi.fn(async (k) => ({ title: `Form ${k}` })),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MySubmissions />
    </MemoryRouter>
  );
}

test("renders table and rows", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
});

test("safe pagination check without label linkage", async () => {
  renderPage();
  await screen.findByRole("table");

  // Select element directly
  const select = document.querySelector(".ipp select");
  expect(select).toBeInTheDocument();
  fireEvent.change(select, { target: { value: "25" } });
});