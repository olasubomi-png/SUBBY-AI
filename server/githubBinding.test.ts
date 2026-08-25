import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getGitHubConnection: vi.fn(),
  githubRequest: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./github", () => ({
  beginGitHubConnection: vi.fn(),
  getGitHubConnection: mocks.getGitHubConnection,
  getProjectRepository: vi.fn(),
  getUserRepository: vi.fn(),
  githubRequest: mocks.githubRequest,
  listGitHubRepositoryBranches: vi.fn(),
}));
vi.mock("./githubConfig", () => ({ isGitHubOAuthConfigured: () => true }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 5, openId: "bind-user", name: "Developer", email: "developer@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("github.bindRepository", () => {
  beforeEach(() => {
    const results: unknown[][] = [
      [{ id: 8, userId: 5, name: "Workspace", status: "building" }],
      [{ id: 31, projectId: 99 }],
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => results.shift() ?? [] }) }) }),
      insert: () => ({ values: mocks.insertValues }),
    };
    mocks.getDb.mockResolvedValue(db);
    mocks.getGitHubConnection.mockResolvedValue({ id: 7, githubLogin: "developer" });
    mocks.githubRequest.mockResolvedValue({ full_name: "owner/game", owner: { login: "owner" }, name: "game", default_branch: "main", private: true });
    mocks.insertValues.mockResolvedValue([]);
  });

  it("reuses an existing repository row instead of inserting a duplicate", async () => {
    const result = await appRouter.createCaller(context()).github.bindRepository({ projectId: 8, fullName: "owner/game" });

    expect(result).toEqual({ success: true, repositoryProjectId: 99 });
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ title: "Repository already connected" }));
  });
});
