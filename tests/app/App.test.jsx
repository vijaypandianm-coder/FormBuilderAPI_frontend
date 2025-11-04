// tests/app/App.test.jsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "../../src/App";

// IMPORTANT: App already contains its own Router.
// Do NOT wrap with MemoryRouter here to avoid “Router inside Router”.

describe("<App />", () => {
  it("bootstraps", () => {
    // minimal smoke render
    render(<App />);
    expect(true).toBe(true);
  });

  it("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});