export function chatRepositoryActions(input: { projectId: number; repositoryId?: number; branch: string; path: string; workflowId: number; instruction: string }) {
  return {
    inspect: { projectId: input.projectId, repositoryId: input.repositoryId, path: input.path, branch: input.branch },
    propose: { projectId: input.projectId, repositoryId: input.repositoryId, path: input.path, branch: input.branch, instruction: input.instruction },
    dispatch: { projectId: input.projectId, repositoryId: input.repositoryId, workflowId: input.workflowId, branch: input.branch, confirmed: true as const },
  };
}

export type ReviewableFileProposal = { path: string; content: string; summary: string; commitMessage: string; baseSha?: string };

export function upsertReviewProposal(proposals: ReviewableFileProposal[], proposal: ReviewableFileProposal) {
  return [...proposals.filter((item) => item.path !== proposal.path), proposal];
}

export function selectReviewProposal(proposals: ReviewableFileProposal[], selectedPath: string) {
  return proposals.find((proposal) => proposal.path === selectedPath) ?? proposals[0];
}

export function clearReviewQueue() {
  return { proposals: [] as ReviewableFileProposal[], selectedPath: "" };
}

export function batchApprovalActions(input: { projectId: number; repositoryId?: number; branch: string; proposals: ReviewableFileProposal[] }) {
  const changes = input.proposals.filter((proposal): proposal is ReviewableFileProposal & { baseSha: string } => Boolean(proposal.baseSha)).map(({ path, content, summary, commitMessage, baseSha }) => ({ path, content, summary, commitMessage, baseSha }));
  return {
    changes,
    pullRequest: { projectId: input.projectId, repositoryId: input.repositoryId, branch: input.branch, changes, confirmed: true as const },
    commit: { projectId: input.projectId, repositoryId: input.repositoryId, branch: input.branch, changes, confirmed: true as const },
  };
}

export function actionsForAttachedChatSession(
  session: { projectId: number | null; repositoryId: number | null; repositoryBranch: string | null },
  fallbackBranch: string,
  input: { path: string; workflowId: number; instruction: string },
) {
  if (!session.projectId || !session.repositoryId) return null;
  return chatRepositoryActions({ projectId: session.projectId, repositoryId: session.repositoryId, branch: session.repositoryBranch || fallbackBranch, ...input });
}
