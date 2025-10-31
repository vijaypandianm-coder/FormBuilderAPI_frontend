import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Stub Header to a simple marker to avoid asset/css noise
vi.mock("@src/components/Header.jsx", () => ({
  default: () => <div data-testid="HEADER">HEADER</div>
}));

import Layout from "@src/components/Layout.jsx";

function renderWithRoute(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/register" element={<div>Register</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("<Layout />", () => {
  it("shows Header on normal routes", () => {
    renderWithRoute("/");
    expect(screen.getByTestId("HEADER")).toBeInTheDocument();
  });

  it("hides Header on /login", () => {
    renderWithRoute("/login");
    expect(screen.queryByTestId("HEADER")).not.toBeInTheDocument();
  });

  it("hides Header on /register", () => {
    renderWithRoute("/register");
    expect(screen.queryByTestId("HEADER")).not.toBeInTheDocument();
  });
});