// tests/services/api.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("src/services/api.js", () => {
  beforeEach(() => {
    // Reset module cache so changes to env apply on each test
    vi.resetModules();
  });

  it("builds apiMongo and apiSql from environment variables", async () => {
    // Arrange: stub env vars that Vite/Vitest exposes via import.meta.env
    vi.stubEnv("VITE_API_BASE_URL_MONGO", "https://mongo.example.com");
    vi.stubEnv("VITE_API_BASE_URL_SQL", "https://sql.example.com");

    // Act: dynamic import AFTER stubbing env so template strings see the values
    const { apiMongo, apiSql } = await import("@src/services/api.js");

    // Assert
    expect(apiMongo).toBe("https://mongo.example.com/api/forms");
    expect(apiSql).toBe("https://sql.example.com/api/responses");
  });

  it("still exports URLs even if env vars are missing/empty", async () => {
    // Arrange: simulate missing/empty envs
    vi.stubEnv("VITE_API_BASE_URL_MONGO", "");
    vi.stubEnv("VITE_API_BASE_URL_SQL", "");

    const { apiMongo, apiSql } = await import("@src/services/api.js");

    // With empty base URLs, it should at least return the path segments
    expect(apiMongo).toBe("/api/forms");
    expect(apiSql).toBe("/api/responses");
  });
});