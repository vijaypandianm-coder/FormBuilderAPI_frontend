import "@testing-library/jest-dom";
import "whatwg-fetch";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// JSDOM shims as needed
class ResizeObserver { observe(){} unobserve(){} disconnect(){} }
window.ResizeObserver = window.ResizeObserver || ResizeObserver;