import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), updateSet: vi.fn(), listBranches: vi.fn(), getUserRepository: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./github", () => ({ listGitHubRepositoryBranches: mocks.listBranches, getUserRepository: mocks.getUserRepository }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 5, openId: "attachment-user", name: "Developer", email: "developer@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("workspace.attachRepositoryToChat", () => {
  beforeEach(() => {
    const results: unknown[][] = [
      [{ id: 14, userId: 5, projectId: null, title: "New conversation" }],
      [{ id: 8, name: "Game", description: null, status: "building" }],
      [{ id: 31, userId: 5, projectId: 8, fullName: "owner/game", defaultBranch: "main" }],
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => results.shift() ?? [] }) }) }),
      update: () => ({ set: (values: unknown) => { mocks.updateSet(values); return { where: async () => undefined }; } }),
      insert: () => ({ values: async () => [{ insertId: 1 }] }),
    };
    mocks.getDb.mockResolvedValue(db);
    mocks.updateSet.mockReset();
    mocks.listBranches.mockResolvedValue(["main", "feature/chat"]);
    mocks.getUserRepository.mockResolvedValue({ id: 31, userId: 5, projectId: 99, fullName: "owner/game", defaultBranch: "main" });
  });

  it("stores the selected repository and branch on the owned conversation session", async () => {
    const result = await appRouter.createCaller(context()).workspace.attachRepositoryToChat({ sessionId: 14, projectId: 8, fullName: "owner/game", branch: "feature/chat" });

    expect(result).toEqual({ repositoryId: 31, fullName: "owner/game", branch: "feature/chat" });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ projectId: 8, repositoryId: 31, repositoryBranch: "feature/chat" }));
  });

  it("reuses a connected repository even when it is linked to another project", async () => {
    const result = await appRouter.createCaller(context()).workspace.attachRepositoryToChat({ sessionId: 14, projectId: 8, fullName: "owner/game", branch: "feature/chat" });

    expect(result.repositoryId).toBe(31);
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ projectId: 8, repositoryId: 31, repositoryBranch: "feature/chat" }));
  });

  it("rejects a branch that is no longer available on the connected repository", async () => {
    mocks.listBranches.mockResolvedValue(["main"]);

    await expect(appRouter.createCaller(context()).workspace.attachRepositoryToChat({ sessionId: 14, projectId: 8, fullName: "owner/game", branch: "feature/chat" }))
      .rejects.toThrow("selected branch no longer exists");
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });
});
