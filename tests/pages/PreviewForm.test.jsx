// tests/pages/PreviewForm.test.jsx
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PreviewForm from "../../src/pages/PreviewForm.jsx";
import { vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  mockNavigate.mockReset();
  localStorage.clear();
});

function seedLS(payload) {
  localStorage.setItem("fb_preview", JSON.stringify(payload));
}

test("renders header, form name/desc and all questions in read-only preview", () => {
  seedLS({
    header: { title: "Employee Onboarding", name: "Join Form", desc: "Welcome!" },
    questions: [
      { id: "q1", type: "short", label: "Full Name", required: true },
      { id: "q2", type: "long", label: "Why us?", required: false, showDescription: true, description: "Tell us more." },
      { id: "q3", type: "date", label: "Start Date", required: true },
      { id: "q4", type: "dropdown", label: "Dept", required: true },
      { id: "q5", type: "file", label: "Resume", required: true },
      { id: "q6", type: "number", label: "Years Exp" },
    ],
  });

  render(
    <MemoryRouter>
      <PreviewForm />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: /employee onboarding/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /join form/i })).toBeInTheDocument();
  expect(screen.getByText("Welcome!")).toBeInTheDocument();

  // Questions present
  expect(screen.getByText(/full name/i)).toBeInTheDocument();
  expect(screen.getByText(/why us/i)).toBeInTheDocument();
  expect(screen.getByText(/tell us more\./i)).toBeInTheDocument();
  expect(screen.getByText(/start date/i)).toBeInTheDocument();
  expect(screen.getByText(/dept/i)).toBeInTheDocument();
  expect(screen.getByText(/resume/i)).toBeInTheDocument();
  expect(screen.getByText(/years exp/i)).toBeInTheDocument();

  // All inputs are disabled/read-only previews
  const inputs = screen.getAllByPlaceholderText(/your answer|numeric value|dd\/mm\/yyyy/i);
  inputs.forEach((el) => expect(el).toBeDisabled());
});

test("Back to Create Form button triggers navigate to /create-form", () => {
  seedLS({ header: {}, questions: [] });
  render(
    <MemoryRouter>
      <PreviewForm />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: /back to create form/i }));
  expect(mockNavigate).toHaveBeenCalledWith("/create-form");
});

test("Back to Form List link is present", () => {
  seedLS({ header: {}, questions: [] });
  render(
    <MemoryRouter>
      <PreviewForm />
    </MemoryRouter>
  );

  const link = screen.getByRole("link", { name: /back to form list/i });
  expect(link).toHaveAttribute("href", "/");
});