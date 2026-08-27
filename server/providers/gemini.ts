import { GoogleGenAI } from "@google/genai";
import { AiProviderError, type SubbyAiProvider, type SubbyAiRequest, type SubbyAiResponse, type SubbyTaskKind } from "./types";

export type GeminiModelConfig = {
  fast: string;
  coding: string;
  reasoning: string;
};

type Environment = Record<string, string | undefined>;

const fallbackModels: GeminiModelConfig = {
  fast: "gemini-3.6-flash",
  coding: "gemini-3.6-flash",
  reasoning: "gemini-3.6-flash",
};

export function getGeminiModelConfig(env: Environment = process.env): GeminiModelConfig {
  return {
    fast: env.GEMINI_MODEL_FAST?.trim() || fallbackModels.fast,
    coding: env.GEMINI_MODEL_CODING?.trim() || fallbackModels.coding,
    reasoning: env.GEMINI_MODEL_REASONING?.trim() || fallbackModels.reasoning,
  };
}

export function selectGeminiModel(task: Exclude<SubbyTaskKind, "auto">, config = getGeminiModelConfig()): string {
  return task === "reasoning" ? config.reasoning : task === "coding" ? config.coding : config.fast;
}

export function selectGeminiModelCandidates(task: Exclude<SubbyTaskKind, "auto">, config = getGeminiModelConfig()): string[] {
  const configured = selectGeminiModel(task, config);
  const safeDefault = selectGeminiModel(task, fallbackModels);
  return configured === safeDefault ? [configured] : [configured, safeDefault];
}

function requiredGeminiKey(env: Environment = process.env): string {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AiProviderError(
      "GEMINI_NOT_CONFIGURED",
      "SUBBY AI is not configured yet. Add GEMINI_API_KEY in the server environment, then restart the service.",
    );
  }
  return key;
}

function toGeminiPrompt(messages: SubbyAiRequest["messages"]): { systemInstruction?: string; contents: string } {
  const systemInstruction = messages.find((message) => message.role === "system")?.content;
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "assistant" ? "SUBBY" : "USER"}:\n${message.content}`)
    .join("\n\n");
  return { systemInstruction, contents };
}

function userSafeGeminiError(error: unknown): AiProviderError {
  const message = error instanceof Error ? error.message : "Gemini request failed.";
  const normalized = message.toLowerCase();
  if (normalized.includes("api key") || normalized.includes("unauthenticated") || normalized.includes("permission denied") || normalized.includes("invalid argument")) {
    return new AiProviderError("GEMINI_REJECTED", "SUBBY could not authenticate with Gemini. Check the server-side Gemini configuration and try again.");
  }
  if (normalized.includes("resource exhausted") || normalized.includes("quota") || normalized.includes("rate limit")) {
    return new AiProviderError("GEMINI_UNAVAILABLE", "Gemini is temporarily unavailable because its configured account has reached a usage or rate limit. Please try again later.");
  }
  return new AiProviderError("GEMINI_UNAVAILABLE", "Gemini is temporarily unavailable. Please try again shortly.");
}

function isFallbackEligibleGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("not found for api version")
    || message.includes("not supported for generatecontent")
    || message.includes("no longer available")
    || message.includes("quota exceeded")
    || message.includes("resource exhausted")
    || message.includes("rate limit");
}

export class GeminiProvider implements SubbyAiProvider {
  constructor(
    private readonly env: Environment = process.env,
    private readonly createClient: (apiKey: string) => Pick<GoogleGenAI, "models"> = (apiKey) => new GoogleGenAI({ apiKey }),
  ) {}

  async complete(request: SubbyAiRequest): Promise<SubbyAiResponse> {
    const apiKey = requiredGeminiKey(this.env);
    const task = request.task === "auto" ? "fast" : request.task;
    const models = selectGeminiModelCandidates(task, getGeminiModelConfig(this.env));
    const { systemInstruction, contents } = toGeminiPrompt(request.messages);

    for (const model of models) {
      try {
        const response = await this.createClient(apiKey).models.generateContent({
          model,
          contents,
          config: {
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(request.responseJsonSchema ? { responseMimeType: "application/json", responseJsonSchema: request.responseJsonSchema } : {}),
          },
        });
        const content = response.text?.trim();
        if (!content) {
          throw new AiProviderError("GEMINI_EMPTY_RESPONSE", "Gemini returned an empty response. Please refine the request and try again.");
        }
        return { content, provider: "gemini", model };
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        if (isFallbackEligibleGeminiError(error) && model !== models[models.length - 1]) continue;
        throw userSafeGeminiError(error);
      }
    }

    throw new AiProviderError("GEMINI_UNAVAILABLE", "Gemini is temporarily unavailable. Please try again shortly.");
  }
}
