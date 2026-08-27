import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  completeSubbyAi: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./providers", () => ({ completeSubbyAi: mocks.completeSubbyAi }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 7, openId: "ai-context-user", name: "Developer", email: "developer@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("workspace.askSubby session context", () => {
  beforeEach(() => {
    const results: unknown[][] = [
      [{ id: 11, userId: 7, projectId: 3, title: "New conversation" }],
      [{ id: 3, name: "Vegas", description: "AI game workspace", status: "building" }],
      [{ fullName: "owner/vegas", defaultBranch: "main" }],
      [],
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => results.shift() ?? [], orderBy: () => ({ limit: async () => results.shift() ?? [] }) }) }) }),
      insert: () => ({ values: async () => [{ insertId: 21 }] }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    mocks.getDb.mockResolvedValue(db);
    mocks.completeSubbyAi.mockResolvedValue({ content: "Safe answer", provider: "gemini", model: "gemini-test" });
  });

  it("injects selected project and repository metadata but no vault values into the LLM request", async () => {
    const result = await appRouter.createCaller(context()).workspace.askSubby({ sessionId: 11, content: "Review the architecture" });
    const systemPrompt = mocks.completeSubbyAi.mock.calls[0][0].messages[0].content as string;

    expect(result.content).toBe("Safe answer");
    expect(systemPrompt).toContain("Project: Vegas");
    expect(systemPrompt).toContain("Linked repository: owner/vegas");
    expect(systemPrompt).toContain("Project Vault values are not part of this context");
    expect(systemPrompt).not.toContain("DATABASE_PASSWORD");
  });
});
