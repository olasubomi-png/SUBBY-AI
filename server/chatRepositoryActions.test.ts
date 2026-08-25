import { describe, expect, it } from "vitest";
import { actionsForAttachedChatSession, chatRepositoryActions } from "../client/src/lib/chatRepositoryActions";

describe("chatRepositoryActions", () => {
  it("preserves the attached branch across inspect, propose, and test workflow requests", () => {
    const actions = chatRepositoryActions({ projectId: 8, branch: "feature/chat", path: "src/App.tsx", workflowId: 42, instruction: "Fix the empty state" });

    expect(actions.inspect).toMatchObject({ branch: "feature/chat", path: "src/App.tsx" });
    expect(actions.propose).toMatchObject({ branch: "feature/chat", instruction: "Fix the empty state" });
    expect(actions.dispatch).toMatchObject({ branch: "feature/chat", workflowId: 42, confirmed: true });
  });

  it("derives action inputs from a persisted repository-attached conversation", () => {
    const actions = actionsForAttachedChatSession(
      { projectId: 8, repositoryId: 31, repositoryBranch: "feature/chat" },
      "main",
      { path: "src/App.tsx", workflowId: 42, instruction: "Fix the empty state" },
    );

    expect(actions?.inspect).toMatchObject({ projectId: 8, branch: "feature/chat", path: "src/App.tsx" });
    expect(actions?.propose).toMatchObject({ projectId: 8, branch: "feature/chat", instruction: "Fix the empty state" });
    expect(actions?.dispatch).toMatchObject({ projectId: 8, branch: "feature/chat", workflowId: 42, confirmed: true });
    expect(actionsForAttachedChatSession({ projectId: 8, repositoryId: null, repositoryBranch: null }, "main", { path: "src/App.tsx", workflowId: 42, instruction: "Fix the empty state" })).toBeNull();
  });
});
