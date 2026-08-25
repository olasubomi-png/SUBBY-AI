import { describe, expect, it } from "vitest";
import { actionsForAttachedChatSession, batchApprovalActions, buildUnifiedDiff, chatRepositoryActions, clearReviewQueue, selectReviewProposal, updateReviewProposalState, upsertReviewProposal, type ReviewableFileProposal } from "../client/src/lib/chatRepositoryActions";

describe("chatRepositoryActions", () => {
  it("preserves the attached branch across inspect, propose, and test workflow requests", () => {
    const actions = chatRepositoryActions({ projectId: 8, branch: "feature/chat", path: "src/App.tsx", workflowId: 42, instruction: "Fix the empty state" });

    expect(actions.inspect).toMatchObject({ branch: "feature/chat", path: "src/App.tsx" });
    expect(actions.propose).toMatchObject({ branch: "feature/chat", instruction: "Fix the empty state" });
    expect(actions.dispatch).toMatchObject({ branch: "feature/chat", workflowId: 42, confirmed: true });
  });

  it("builds explicit batched approval payloads only from fresh reviewed files", () => {
    const actions = batchApprovalActions({ projectId: 8, repositoryId: 31, branch: "feature/chat", proposals: [
      { path: "src/App.tsx", content: "new app", summary: "Repair app", commitMessage: "fix: app", baseSha: "sha-app", state: "approved" },
      { path: "src/theme.css", content: "new theme", summary: "Repair theme", commitMessage: "fix: theme" },
    ] });
    expect(actions.pullRequest).toMatchObject({ projectId: 8, repositoryId: 31, branch: "feature/chat", confirmed: true });
    expect(actions.commit.changes).toEqual([{ path: "src/App.tsx", content: "new app", summary: "Repair app", commitMessage: "fix: app", baseSha: "sha-app" }]);
  });

  it("maintains the review queue, selects a file, and clears it before any write", () => {
    const first: ReviewableFileProposal = { path: "src/App.tsx", content: "old", summary: "Repair app", commitMessage: "fix: app", baseSha: "sha-1" };
    const second: ReviewableFileProposal = { path: "src/theme.css", content: "theme", summary: "Repair theme", commitMessage: "fix: theme", baseSha: "sha-2" };
    const replaced = upsertReviewProposal(upsertReviewProposal([], first), { ...first, content: "new" });
    const queued = upsertReviewProposal(replaced, second);
    expect(queued).toHaveLength(2);
    expect(selectReviewProposal(queued, "src/theme.css")?.content).toBe("theme");
    expect(selectReviewProposal(queued, "missing.ts")?.path).toBe("src/App.tsx");
    expect(updateReviewProposalState(queued, "src/App.tsx", "approved")[0].state).toBe("approved");
    expect(updateReviewProposalState(queued, "src/theme.css", "rejected")[1].state).toBe("rejected");
    expect(clearReviewQueue()).toEqual({ proposals: [], selectedPath: "" });
  });

  it("renders a bounded unified diff with context and line metadata", () => {
    const diff = buildUnifiedDiff("const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\nconst f = 6;", "const a = 1;\nconst b = 3;\nconst c = 3;\nconst d = 4;\nconst e = 8;\nconst f = 6;", 1);
    expect(diff.additions).toBe(2);
    expect(diff.removals).toBe(2);
    expect(diff.lines.some((line) => line.type === "removed" && line.text === "const b = 2;")).toBe(true);
    expect(diff.lines.some((line) => line.type === "added" && line.text === "const b = 3;")).toBe(true);
    expect(diff.lines.some((line) => line.type === "context" && line.text === "const a = 1;")).toBe(true);
    expect(diff.lines.some((line) => line.type === "hunk")).toBe(true);
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
