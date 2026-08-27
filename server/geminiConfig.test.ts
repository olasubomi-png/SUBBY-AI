import { describe, expect, it } from "vitest";

describe("Gemini server configuration", () => {
  it("authenticates against the Gemini model catalog without exposing the API key", async () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    expect(apiKey, "GEMINI_API_KEY must be configured for Gemini-backed SUBBY AI").toBeTruthy();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey! },
    });

    expect(response.status, "Gemini rejected the configured server-side API key").toBe(200);
    const payload = await response.json() as { models?: unknown[] };
    expect(Array.isArray(payload.models), "Gemini model catalog response is invalid").toBe(true);
  }, 20_000);
});
