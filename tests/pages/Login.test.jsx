import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

// Auth mock matches src/pages/Login.jsx import: "../api/auth"
vi.mock("@src/api/auth", () => ({
  AuthService: {
    login: vi.fn(async ({ email }) => {
      // return shape doesn't matter much; role is read via getProfile()
      return { token: "tok", user: { email } };
    }),
    getProfile: vi.fn(() => {
      // we'll override return values per test via mockImplementationOnce
      return { role: "User" };
    }),
  },
}));

import Login from "@src/pages/Login.jsx";

function renderAt(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/learn" element={<div>LEARN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("<Login />", () => {
  test("admin → navigates to /", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.getProfile.mockImplementationOnce(() => ({ role: "Admin" }));

    renderAt();
    const u = userEvent.setup();

    // Placeholders are "Email" and "Password"
    await u.type(screen.getByPlaceholderText(/email/i), "admin@a.com");
    await u.type(screen.getByPlaceholderText(/password/i), "secret");
    await u.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("HOME")).toBeInTheDocument();
  });

  test("non-admin → navigates to /learn", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.getProfile.mockImplementationOnce(() => ({ role: "User" }));

    renderAt();
    const u = userEvent.setup();

    await u.type(screen.getByPlaceholderText(/email/i), "user@a.com");
    await u.type(screen.getByPlaceholderText(/password/i), "secret");
    await u.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("LEARN")).toBeInTheDocument();
  });

  test("shows API error when login fails", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.login.mockRejectedValueOnce(new Error("Login failed"));

    renderAt();
    const u = userEvent.setup();

    await u.type(screen.getByPlaceholderText(/email/i), "boom@a.com");
    await u.type(screen.getByPlaceholderText(/password/i), "x");
    await u.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
});