export type SubbyAiRole = "system" | "user" | "assistant";

export type SubbyTaskKind = "auto" | "fast" | "coding" | "reasoning";

export type SubbyAiMessage = {
  role: SubbyAiRole;
  content: string;
};

export type SubbyAiRequest = {
  messages: SubbyAiMessage[];
  task: SubbyTaskKind;
  responseJsonSchema?: Record<string, unknown>;
};

export type SubbyAiResponse = {
  content: string;
  provider: "gemini";
  model: string;
};

export class AiProviderError extends Error {
  constructor(
    public readonly code: "GEMINI_NOT_CONFIGURED" | "GEMINI_REJECTED" | "GEMINI_UNAVAILABLE" | "GEMINI_EMPTY_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface SubbyAiProvider {
  complete(request: SubbyAiRequest): Promise<SubbyAiResponse>;
}
