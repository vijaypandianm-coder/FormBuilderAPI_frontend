import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@src/api/auth.js", () => ({
  AuthService: { isAuthenticated: vi.fn(() => false) }
}));

import { AuthService } from "@src/api/auth.js";
import PrivateRoute from "@src/components/PrivateRoute.jsx";

function App() {
  return (
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<PrivateRoute />}>
          <Route path="/admin" element={<div>Admin Area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("<PrivateRoute />", () => {
  it("redirects to /login when not authed", () => {
    AuthService.isAuthenticated.mockReturnValue(false);
    render(<App />);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders outlet when authed", () => {
    AuthService.isAuthenticated.mockReturnValue(true);
    render(<App />);
    expect(screen.getByText("Admin Area")).toBeInTheDocument();
  });
});