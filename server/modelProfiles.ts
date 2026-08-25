import type { ModelInfo } from "./_core/llm";

export const modelProfiles = ["auto", "quality", "fast", "economy"] as const;
export type ModelProfile = (typeof modelProfiles)[number];

const chooseFirst = (models: ModelInfo[], patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const model = models.find((entry) => pattern.test(entry.id));
    if (model) return model.id;
  }
  return models[0]?.id;
};

export function selectModel(models: ModelInfo[], profile: ModelProfile = "auto") {
  if (!models.length) return undefined;
  if (profile === "fast") return chooseFirst(models, [/mini/i, /flash/i, /haiku/i, /small/i, /fast/i]);
  if (profile === "economy") return chooseFirst(models, [/haiku/i, /mini/i, /flash/i, /nano/i, /economy/i]);
  if (profile === "quality") return chooseFirst(models, [/opus/i, /sonnet/i, /reason/i, /gpt-5/i, /gpt-4/i]);
  return chooseFirst(models, [/claude/i, /gpt/i, /gemini/i]);
}

export function modelProfileLabel(profile: ModelProfile) {
  return profile === "quality" ? "Best quality" : profile === "fast" ? "Fast" : profile === "economy" ? "Economy" : "Auto";
}
