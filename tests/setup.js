import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";

// --- Patch import.meta.env for Vite compatibility ---
if (!import.meta.env) {
  globalThis.importMeta = { env: {} };
  Object.defineProperty(import.meta, "env", {
    get() {
      return globalThis.importMeta.env;
    },
  });
}

Object.assign(import.meta.env, {
  VITE_API_BASE_URL: "",
  VITE_API_BASE_URL_MONGO: "",
  MODE: "test",
  DEV: false,
  PROD: true,
});

// --- Safe localStorage mock for auth & token tests ---
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

// --- Stub window.confirm / alert / scroll ---
global.confirm = vi.fn(() => true);
global.alert = vi.fn();
global.scrollTo = vi.fn();

// --- Patch CSSStyleDeclaration for style warnings (jsdom crash fix) ---
if (!Object.getOwnPropertyDescriptor(window.CSSStyleDeclaration.prototype, "setProperty")?.value) {
  Object.defineProperty(window.CSSStyleDeclaration.prototype, "setProperty", {
    value: function (prop, val) {
      try {
        this[prop] = val;
      } catch {}
    },
  });
}

// --- Optional: Expose test env flag for app logic ---
Object.defineProperty(window, "IS_TEST_ENV", {
  value: true,
  configurable: false,
  writable: false,
});

// --- Suppress noisy React Router Future Flag Warnings ---
let originalWarn;
beforeAll(() => {
  originalWarn = console.warn;
  vi.spyOn(console, "warn").mockImplementation((msg, ...args) => {
    if (typeof msg === "string" && msg.includes("React Router Future Flag Warning")) return;
    if (typeof msg === "string" && msg.includes("Relative route resolution within Splat routes")) return;
    return originalWarn?.(msg, ...args);
  });
});

// --- Reset spies & storage between tests ---
beforeEach(() => {
  vi.restoreAllMocks(); // restores spies created with vi.spyOn / vi.fn().mock...
  localStorage.clear();
});
global.IS_REACT_ACT_ENVIRONMENT = false;
// --- Cleanup DOM after each test ---
afterEach(() => cleanup());