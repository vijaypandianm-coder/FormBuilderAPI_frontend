import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- stub pages the App imports (simple, no Routers here) ---
vi.mock("@src/pages/AdminDashboard", () => ({
  default: () => <div data-testid="page:AdminDashboard">AdminDashboard</div>,
}));
vi.mock("@src/pages/CreateForm", () => ({
  default: () => <div data-testid="page:CreateForm">CreateForm</div>,
}));
vi.mock("@src/pages/PreviewForm", () => ({
  default: () => <div data-testid="page:PreviewForm">PreviewForm</div>,
}));
vi.mock("@src/pages/ViewForm", () => ({
  default: () => <div data-testid="page:ViewForm">ViewForm</div>,
}));
vi.mock("@src/pages/Login", () => ({
  default: () => <div data-testid="page:Login">Login</div>,
}));
vi.mock("@src/pages/Register", () => ({
  default: () => <div data-testid="page:Register">Register</div>,
}));
vi.mock("@src/pages/LearnerForms", () => ({
  default: () => <div data-testid="page:LearnerForms">LearnerForms</div>,
}));
vi.mock("@src/pages/MySubmissions", () => ({
  default: () => <div data-testid="page:MySubmissions">MySubmissions</div>,
}));
vi.mock("@src/pages/MySubmissionDetail", () => ({
  default: () => <div data-testid="page:MySubmissionDetail">MySubmissionDetail</div>,
}));
vi.mock("@src/pages/FormSubmissionPage", () => ({
  default: () => <div data-testid="page:FormSubmissionPage">FormSubmissionPage</div>,
}));

// --- Layout must render an <Outlet /> for nested routes in RRv6 ---
vi.mock("@src/components/Layout", () => ({
  default: () => {
    const { Outlet } = require("react-router-dom"); // require to avoid hoist issues
    return (
      <div data-testid="layout">
        <Outlet />
      </div>
    );
  },
}));

// --- mock AuthService for RoleHome ---
vi.mock("@src/api/auth", () => ({ AuthService: { getToken: vi.fn() } }));

function makeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.`;
}

describe("App routing & RoleHome (no extra Router wrapper)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("admin at '/' -> AdminDashboard", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.getToken.mockReturnValue(makeJwt({ role: "admin" }));

    const App = (await import("@src/App.jsx")).default;
    render(<App />); // App includes BrowserRouter internally

    expect(await screen.findByTestId("page:AdminDashboard")).toBeInTheDocument();
  });

  it("roles array containing admin -> AdminDashboard", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.getToken.mockReturnValue(makeJwt({ roles: ["admin", "x"] }));

    const App = (await import("@src/App.jsx")).default;
    render(<App />);

    expect(await screen.findByTestId("page:AdminDashboard")).toBeInTheDocument();
  });

  it("non-admin -> LearnerForms", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.getToken.mockReturnValue(makeJwt({ role: "user" }));

    const App = (await import("@src/App.jsx")).default;
    render(<App />);

    expect(await screen.findByTestId("page:LearnerForms")).toBeInTheDocument();
  });

  it("no token -> LearnerForms", async () => {
    const { AuthService } = await import("@src/api/auth");
    AuthService.getToken.mockReturnValue(null);

    const App = (await import("@src/App.jsx")).default;
    render(<App />);

    expect(await screen.findByTestId("page:LearnerForms")).toBeInTheDocument();
  });
});