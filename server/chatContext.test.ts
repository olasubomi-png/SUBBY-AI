import { describe, expect, it } from "vitest";
import { buildSafeChatContext, buildSubbySystemPrompt } from "./chatContext";

describe("buildSafeChatContext", () => {
  it("includes project and repository metadata while excluding vault values", () => {
    const context = buildSafeChatContext(
      { name: "SUBBY", description: "AI developer workspace", status: "building" },
      { fullName: "owner/repository", defaultBranch: "main" },
    );

    expect(context).toContain("Project: SUBBY");
    expect(context).toContain("Linked repository: owner/repository");
    expect(context).toContain("Project Vault values are not part of this context");
    expect(context).not.toContain("DATABASE_PASSWORD");
  });

  it("separates Plan mode from Agent mode without weakening safety boundaries", () => {
    const safeContext = buildSafeChatContext({ name: "Vegas", description: "Game backend", status: "building" }, { fullName: "owner/game", defaultBranch: "main" });
    const planPrompt = buildSubbySystemPrompt(safeContext, "plan");
    const agentPrompt = buildSubbySystemPrompt(safeContext, "agent");

    expect(planPrompt).toContain("You are in Plan mode");
    expect(planPrompt).toContain("Do not present planned work as completed");
    expect(agentPrompt).toContain("You are in Agent mode");
    expect(agentPrompt).toContain("Never claim arbitrary shell execution");
    expect(planPrompt).not.toContain("DATABASE_PASSWORD");
    expect(agentPrompt).not.toContain("DATABASE_PASSWORD");
  });

  it("passes only safe session context into the AI system prompt boundary", () => {
    const safeContext = buildSafeChatContext(
      { name: "Vegas", description: "Game backend", status: "building" },
      { fullName: "owner/game", defaultBranch: "main" },
    );
    const prompt = buildSubbySystemPrompt(safeContext);

    expect(prompt).toContain("Project: Vegas");
    expect(prompt).toContain("Linked repository: owner/game");
    expect(prompt).toContain("Never request, reveal, infer, or use Project Vault values in chat or shell commands");
    expect(prompt).toContain("manually dispatchable GitHub Actions workflows after confirmation");
    expect(prompt).toContain("If a branch is protected, recommend the pull-request path");
    expect(prompt).not.toContain("DATABASE_PASSWORD");
  });
});
