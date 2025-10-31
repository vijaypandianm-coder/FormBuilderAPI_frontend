import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@src/api/auth.js", () => ({
  AuthService: {
    login: vi.fn(async () => {}),
    getProfile: vi.fn(() => ({ role: "admin" })),
  },
}));

import Login from "@src/pages/Login.jsx";
import { AuthService } from "@src/api/auth.js";

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>ADMIN DASH</div>} />
        <Route path="/learn" element={<div>LEARN LIST</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("<Login />", () => {
  it("signs in admin → navigates to /", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/username or email/i), "a@a.com");
    await user.type(screen.getByPlaceholderText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(AuthService.login).toHaveBeenCalled();
    expect(await screen.findByText("ADMIN DASH")).toBeInTheDocument();
  });

  it("non-admin role navigates to /learn", async () => {
    AuthService.getProfile.mockReturnValue({ role: "user" });
    renderApp();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/username or email/i), "a@a.com");
    await user.type(screen.getByPlaceholderText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("LEARN LIST")).toBeInTheDocument();
  });

  it("shows error when login throws", async () => {
    AuthService.login.mockRejectedValueOnce(new Error("Nope"));
    renderApp();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/username or email/i), "a@a.com");
    await user.type(screen.getByPlaceholderText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });
});