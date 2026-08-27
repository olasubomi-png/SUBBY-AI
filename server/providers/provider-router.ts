import type { ModelProfile } from "../modelProfiles";
import { GeminiProvider } from "./gemini";
import type { SubbyAiRequest, SubbyTaskKind } from "./types";

const codingSignals = /\b(code|coding|bug|debug|test|typescript|javascript|python|react|api|repository|repo|file|function|build|lint|commit|pull request)\b/i;
const reasoningSignals = /\b(plan|architecture|analyse|analyze|strategy|design|compare|trade.?off|investigate|root cause|roadmap)\b/i;

export function selectSubbyTask(profile: ModelProfile = "auto", content = ""): Exclude<SubbyTaskKind, "auto"> {
  if (profile === "quality") return "reasoning";
  if (profile === "fast" || profile === "economy") return "fast";
  if (codingSignals.test(content)) return "coding";
  if (reasoningSignals.test(content)) return "reasoning";
  return "fast";
}

export async function completeSubbyAi(
  request: Omit<SubbyAiRequest, "task"> & { modelProfile?: ModelProfile; task?: SubbyTaskKind },
) {
  const finalUserMessage = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const task = request.task && request.task !== "auto" ? request.task : selectSubbyTask(request.modelProfile, finalUserMessage);
  return new GeminiProvider().complete({ ...request, task });
}
