import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@src/assets/duplicate.png", () => ({ default: "dup.png" }), { virtual: true });
vi.mock("@src/assets/Trash.png", () => ({ default: "trash.png" }), { virtual: true });

vi.mock("@src/api/auth.js", () => ({
  AuthService: { isAuthenticated: vi.fn(() => false) },
}));
vi.mock("@src/api/forms.js", () => ({
  FormService: {
    create: vi.fn(async () => ({ formKey: "NEW1" })),
    update: vi.fn(async () => ({ formKey: "EXIST1" })),
  },
}));

// const reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => {});
const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
const stSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);

import CreateForm from "@src/pages/CreateForm.jsx";
import { AuthService } from "@src/api/auth.js";
import { FormService } from "@src/api/forms.js";

function renderApp(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/create-form", state }]}>
      <Routes>
        <Route path="/create-form" element={<CreateForm />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("<CreateForm />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("Next disabled until Form Name entered; then switches to layout", () => {
    renderApp();
    const next = screen.getByRole("button", { name: /next/i });
    expect(next).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/enter the form name/i), { target: { value: "My Form" } });
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    // Layout tab visible by presence of footer buttons
    expect(screen.getByText(/preview form/i)).toBeInTheDocument();
  });

  it("Save as draft stores locally when unauthenticated", () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    renderApp();
    fireEvent.change(screen.getByPlaceholderText(/enter the form name/i), { target: { value: "Offline Form" } });
    // stay in config tab; click Save as draft
    fireEvent.click(screen.getByRole("button", { name: /save as draft/i }));

    // navigated home
    expect(screen.getByText("HOME")).toBeInTheDocument();
    // local saved
    const raw = localStorage.getItem("fb_forms");
    expect(raw).toContain("Offline Form");
  });

  it("Publish removes fb_create and navigates home (unauthenticated → local)", () => {
    localStorage.setItem("fb_create", JSON.stringify({ name: "X" }));
    renderApp();
    fireEvent.change(screen.getByPlaceholderText(/enter the form name/i), { target: { value: "Pub Form" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /publish form/i }));

    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(localStorage.getItem("fb_create")).toBeNull();
  });
});