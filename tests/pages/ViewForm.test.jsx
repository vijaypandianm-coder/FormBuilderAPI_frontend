import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

Object.defineProperty(window.CSSStyleDeclaration.prototype, "setProperty", {
  value: function (prop, val) {
    try { this[prop] = val; } catch {}
  },
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useParams: () => ({ formKey: "123" }),
    useNavigate: () => mockNavigate,
  };
});

const mockGetForm = vi.fn();
const mockListResponses = vi.fn();

vi.mock("../../src/api/forms", () => ({
  FormService: { get: (...args) => mockGetForm(...args) },
}));
vi.mock("../../src/api/responses", () => ({
  ResponsesApi: { list: (...args) => mockListResponses(...args) },
}));

import ViewForm from "../../src/pages/ViewForm.jsx";

function renderPage() {
  return render(
    <MemoryRouter>
      <ViewForm />
    </MemoryRouter>
  );
}

test("renders config tab and form fields safely", async () => {
  mockGetForm.mockResolvedValue({
    title: "Training Needs Survey",
    description: "Quarterly pulse",
    status: "Published",
    layout: { sections: [] },
  });

  renderPage();

  // Instead of getByText (input values are not visible text)
  const titleInput = await screen.findByDisplayValue("Training Needs Survey");
  expect(titleInput).toBeInTheDocument();

  const descText = await screen.findByDisplayValue("Quarterly pulse");
  expect(descText).toBeInTheDocument();
});

test("Responses summary shows and paginates safely", async () => {
  mockGetForm.mockResolvedValue({
    title: "Survey",
    description: "",
    status: "Published",
    layout: { sections: [] },
  });
  mockListResponses.mockResolvedValue([
    { responseId: 1, userId: 1001, submittedAt: "2025-10-10T10:10:10Z" },
    { responseId: 2, userId: 1002, submittedAt: "2025-10-11T10:10:10Z" },
  ]);

  renderPage();

  fireEvent.click(await screen.findByRole("tab", { name: /responses/i }));
  await screen.findByRole("table");

  const select = document.querySelector(".vf-ipp select");
  fireEvent.change(select, { target: { value: "25" } });
  expect(select.value).toBe("25");
});