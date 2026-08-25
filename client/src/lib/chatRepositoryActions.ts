export function chatRepositoryActions(input: { projectId: number; repositoryId?: number; branch: string; path: string; workflowId: number; instruction: string }) {
  return {
    inspect: { projectId: input.projectId, repositoryId: input.repositoryId, path: input.path, branch: input.branch },
    propose: { projectId: input.projectId, repositoryId: input.repositoryId, path: input.path, branch: input.branch, instruction: input.instruction },
    dispatch: { projectId: input.projectId, repositoryId: input.repositoryId, workflowId: input.workflowId, branch: input.branch, confirmed: true as const },
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
