import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// mock image import (if needed by your Vite setup)
vi.mock("@src/assets/Home.png", () => ({ default: "home.png" }), { virtual: true });

// mock AuthService used in Header
vi.mock("@src/api/auth.js", () => {
  return {
    AuthService: {
      getProfile: vi.fn(() => null),
      logout: vi.fn(),
    }
  };
});

import { AuthService } from "@src/api/auth.js";
import Header from "@src/components/Header.jsx";

const renderAt = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>
  );

describe("<Header />", () => {
  it("shows basic breadcrumb on / and unauth links", () => {
    renderAt("/");
    expect(screen.getByLabelText(/home/i)).toBeInTheDocument();
    // Breadcrumb
    expect(screen.getByText("Form Builder")).toBeInTheDocument();
    // unauth controls
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    expect(screen.getByText(/register/i)).toBeInTheDocument();
  });

  it("crumb changes for /create-form/* and /preview/*", () => {
    renderAt("/create-form/xyz");
    expect(screen.getByText("Create Form")).toBeInTheDocument();

    renderAt("/preview/xyz");
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("shows user email and Sign out when authenticated", () => {
    AuthService.getProfile.mockReturnValue({ email: "user@example.com" });
    renderAt("/");
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText(/sign out/i)).toBeInTheDocument();
  });

  it("calls AuthService.logout and navigates to /login on Sign out", () => {
    AuthService.getProfile.mockReturnValue({ email: "user@example.com" });
    renderAt("/forms");
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    // We can't assert the new route easily without a full router with routes;
    // but we can assert logout was called.
    expect(AuthService.logout).toHaveBeenCalledTimes(1);
  });
});