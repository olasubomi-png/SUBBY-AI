import { describe, expect, it } from "vitest";
import { GeminiProvider, getGeminiModelConfig, selectGeminiModel, selectGeminiModelCandidates } from "./gemini";
import { selectSubbyTask } from "./provider-router";

describe("Gemini provider routing", () => {
  it("uses centralized configured models and safe defaults", () => {
    const config = getGeminiModelConfig({ GEMINI_MODEL_FAST: "fast-model", GEMINI_MODEL_CODING: "code-model", GEMINI_MODEL_REASONING: "reasoning-model" });
    expect(selectGeminiModel("fast", config)).toBe("fast-model");
    expect(selectGeminiModel("coding", config)).toBe("code-model");
    expect(selectGeminiModel("reasoning", config)).toBe("reasoning-model");
    expect(getGeminiModelConfig({}).fast).toBeTruthy();
    expect(selectGeminiModelCandidates("fast", config)).toEqual(["fast-model", "gemini-3.6-flash"]);
  });

  it("maps profiles and task language to configured Gemini task classes", () => {
    expect(selectSubbyTask("fast", "Explain this repository")).toBe("fast");
    expect(selectSubbyTask("quality", "Write a component")).toBe("reasoning");
    expect(selectSubbyTask("auto", "Debug this TypeScript build error")).toBe("coding");
    expect(selectSubbyTask("auto", "Create an architecture plan")).toBe("reasoning");
  });

  it("fails safely before an outbound request when Gemini is not configured", async () => {
    const provider = new GeminiProvider({});
    await expect(provider.complete({ task: "fast", messages: [{ role: "user", content: "hello" }] })).rejects.toMatchObject({ code: "GEMINI_NOT_CONFIGURED" });
  });
});
