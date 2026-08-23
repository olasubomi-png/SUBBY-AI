import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "subby-workspace-test",
      email: "developer@example.com",
      name: "Developer",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace.overview", () => {
  it("returns a usable empty workspace when storage is unavailable", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.workspace.overview();

    expect(result.summary).toEqual({ totalProjects: 0, activeProjects: 0, inProgressTasks: 0, completedTasks: 0 });
    expect(result.projects).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.activity).toEqual([]);
  });
});

describe("workspace.chatHistory", () => {
  it("accepts general-workspace context and returns an empty history without storage", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.workspace.chatHistory({ projectId: null });

    expect(result).toEqual([]);
  });
});

describe("workspace input validation", () => {
  it("rejects malformed project, task, and co-developer requests before side effects", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.workspace.createProject({ name: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.workspace.createTask({ title: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.workspace.askSubby({ content: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
