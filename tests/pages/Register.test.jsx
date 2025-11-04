import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

// Matches src/pages/Register.jsx import: "../api/auth"
vi.mock("@src/api/auth", () => ({
  AuthService: {
    register: vi.fn(async ({ username, email }) => {
      // Simulate success always; component always routes to /login after register
      return { user: { username, email } };
    }),
  },
}));

import Register from "@src/pages/Register.jsx";

function renderAt(path = "/register") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit({
  username = "Alice",
  email = "a@b.com",
  pw = "secret1",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText(/username/i), {
    target: { value: username },
  });
  fireEvent.change(screen.getByPlaceholderText(/email address/i), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
    target: { value: pw },
  });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("<Register />", () => {
  test("routes to /login with message on success", async () => {
    renderAt();
    fillAndSubmit();
    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
  });

  test("shows API error when register fails", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.register.mockRejectedValueOnce(new Error("Registration failed"));

    renderAt();
    fillAndSubmit();
    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument();
  });
});