// tests/pages/Register.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Register from "../../src/pages/Register.jsx";
import { vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children }) => <a href={to}>{children}</a>,
  };
});

const mockRegister = vi.fn();
const mockGetToken = vi.fn();
const mockGetProfile = vi.fn();

vi.mock("../../src/api/auth", () => ({
  AuthService: {
    register: (...args) => mockRegister(...args),
    getToken: () => mockGetToken(),
    getProfile: () => mockGetProfile(),
  },
}));

beforeEach(() => {
  mockNavigate.mockReset();
  mockRegister.mockReset();
  mockGetToken.mockReset();
  mockGetProfile.mockReset();
});

function fillAndSubmit({ name = "Alice", email = "a@b.com", pw = "secret1", pw2 = "secret1" } = {}) {
  fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText(/email address/i), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText(/^password$/i), { target: { value: pw } });
  fireEvent.change(screen.getByPlaceholderText(/confirm password/i), { target: { value: pw2 } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

test("shows error when passwords mismatch", () => {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
  fillAndSubmit({ pw: "a", pw2: "b" });

  expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  expect(mockRegister).not.toHaveBeenCalled();
});

test("successful register with token and admin role navigates to /", async () => {
  mockRegister.mockResolvedValue({});
  mockGetToken.mockReturnValue("tkn");
  mockGetProfile.mockReturnValue({ role: "admin" });

  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );

  fillAndSubmit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true }));
});

test("successful register with token and non-admin role navigates to /learn", async () => {
  mockRegister.mockResolvedValue({});
  mockGetToken.mockReturnValue("tkn");
  mockGetProfile.mockReturnValue({ role: "employee" });

  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );

  fillAndSubmit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/learn", { replace: true }));
});

test("successful register without token routes to /login with state message", async () => {
  mockRegister.mockResolvedValue({});
  mockGetToken.mockReturnValue(undefined);

  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );

  fillAndSubmit();
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      replace: true,
      state: { msg: "Account created. Please sign in." },
    })
  );
});

test("shows API error message when register fails", async () => {
  mockRegister.mockRejectedValue(new Error("email already exists"));

  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );

  fillAndSubmit();
  expect(await screen.findByText(/email already exists/i)).toBeInTheDocument();
});