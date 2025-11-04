/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "src"),
      "@tests": path.resolve(__dirname, "tests"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{js,jsx,ts,tsx}"],
    setupFiles: ["./tests/setup.js"],   // <-- make sure the file exists
    restoreMocks: true,
    css: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "text-summary", "html"],
      reportsDirectory: "./coverage",
      all: true,
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["tests/**", "node_modules/**"],
      // to enforce 95%:
      lines: 95,
      functions: 95,
      branches: 95,
      statements: 95,
    },
  },
});