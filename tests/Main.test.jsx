// tests/Main.test.jsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- spies for react-dom/client ---
const renderSpy = vi.fn();
const createRootSpy = vi.fn(() => ({ render: renderSpy }));

// Mock react-dom/client so main.jsx doesn't mount a real app
vi.mock("react-dom/client", () => ({
  __esModule: true,
  default: { createRoot: createRootSpy },
  createRoot: createRootSpy,
}));

// Mock App so we don't pull in the real router tree
vi.mock("@src/App.jsx", () => ({
  __esModule: true,
  default: () => <div data-testid="app-root">MockApp</div>,
}));

describe("main.jsx bootstrap", () => {
  beforeEach(() => {
    // reset spies
    renderSpy.mockClear();
    createRootSpy.mockClear();

    // set up a fresh #root each test
    document.body.innerHTML = "";
    const rootEl = document.createElement("div");
    rootEl.id = "root";
    document.body.appendChild(rootEl);
  });

  it("calls createRoot and renders <App />", async () => {
    // Importing main.jsx should run the bootstrap code once
    await import("@src/main.jsx");

    // createRoot called once with the #root element
    expect(createRootSpy).toHaveBeenCalledTimes(1);
    const rootArg = createRootSpy.mock.calls[0][0];
    expect(rootArg).toBe(document.getElementById("root"));

    // render called once with a React element (StrictMode/App tree)
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const firstRenderArg = renderSpy.mock.calls[0][0];
    expect(firstRenderArg).toBeTruthy();
  });
});