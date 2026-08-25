import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }),
  session: { id: 14, projectId: 8, repositoryId: 31, repositoryBranch: "feature/chat", title: "Repair the chat flow", createdAt: Date.now(), updatedAt: Date.now() },
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ workspace: { listChatSessions: { invalidate: vi.fn() }, chatHistory: { invalidate: vi.fn() }, overview: { invalidate: vi.fn() } } }),
    workspace: {
      overview: { useQuery: () => ({ data: { projects: [{ id: 8, name: "Game", description: null, status: "building" }], tasks: [{ id: 5, projectId: 8, title: "Repair input", detail: "Resolve the composer layout", status: "queued" }] } }) },
      listChatSessions: { useQuery: () => ({ data: [mocks.session], isLoading: false }) },
      chatHistory: { useQuery: () => ({ data: [], isLoading: false }) },
      listFiles: { useQuery: () => ({ data: [{ id: 7, path: "src/App.tsx", language: "typescript", content: "export default {}" }] }) },
      projectVaultStatus: { useQuery: () => ({ data: { configured: true } }) },
      createChatSession: { useMutation: mocks.mutation },
      askSubby: { useMutation: mocks.mutation },
      attachRepositoryToChat: { useMutation: mocks.mutation },
      createTask: { useMutation: mocks.mutation },
      generateMediaImage: { useMutation: mocks.mutation },
      saveProjectSecret: { useMutation: mocks.mutation },
    },
    github: {
      status: { useQuery: () => ({ data: { connection: { id: 2 } } }) },
      listRepositories: { useQuery: () => ({ data: [] }) },
      listRepositoryBranches: { useQuery: () => ({ data: ["main", "feature/chat"] }) },
      repositoryContext: { useQuery: () => ({ data: { repository: { fullName: "owner/game", defaultBranch: "feature/chat" }, files: ["src/App.tsx"] } }) },
      listWorkflows: { useQuery: () => ({ data: [{ id: 42, name: "Tests", state: "active", dispatchable: true }] }) },
      bindRepository: { useMutation: mocks.mutation },
      inspectFile: { useMutation: mocks.mutation },
      proposeFileFix: { useMutation: () => ({ ...mocks.mutation(), data: { path: "src/App.tsx", content: "export default {}", summary: "Repair the empty state", commitMessage: "fix: repair empty state" } }) },
      dispatchWorkflow: { useMutation: mocks.mutation },
      createPullRequest: { useMutation: mocks.mutation },
      commitApprovedChange: { useMutation: mocks.mutation },
    },
  },
}));
vi.mock("../client/src/components/AIChatBox", () => ({ AIChatBox: () => createElement("div", { "data-testid": "ai-chat-box" }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Chat from "../client/src/pages/Chat";

describe("Chat repository-attached controls", () => {
  it("renders branch-specific inspection, test, proposal, and approval controls for an attached session", () => {
    const html = renderToStaticMarkup(createElement(Chat));

    expect(html).toContain("owner/game");
    expect(html).toContain("feature/chat");
    expect(html).toContain("Inspect");
    expect(html).toContain("Test");
    expect(html).toContain("Propose");
    expect(html).toContain("Approve PR");
    expect(html).toContain("Approve commit to feature/chat");
  });
});
