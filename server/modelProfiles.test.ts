import { describe, expect, it } from "vitest";
import type { ModelInfo } from "./_core/llm";
import { selectModel } from "./modelProfiles";

const models = (ids: string[]) => ids.map((id) => ({ id, object: "model", created: 0, owned_by: "test" }) as ModelInfo);

describe("model profiles", () => {
  const catalog = models(["gpt-5", "claude-sonnet-4-6", "claude-haiku-4-5", "gemini-2.5-flash"]);

  it("routes quality to a high-capability model", () => {
    expect(selectModel(catalog, "quality")).toBe("claude-sonnet-4-6");
  });

  it("routes fast and economy to lightweight models", () => {
    expect(selectModel(catalog, "fast")).toBe("gemini-2.5-flash");
    expect(selectModel(catalog, "economy")).toBe("claude-haiku-4-5");
  });

  it("keeps Auto provider-agnostic and falls back safely", () => {
    expect(selectModel(catalog, "auto")).toBe("claude-sonnet-4-6");
    expect(selectModel([], "auto")).toBeUndefined();
  });
});
