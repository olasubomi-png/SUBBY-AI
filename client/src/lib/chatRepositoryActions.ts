export function chatRepositoryActions(input: { projectId: number; branch: string; path: string; workflowId: number; instruction: string }) {
  return {
    inspect: { projectId: input.projectId, path: input.path, branch: input.branch },
    propose: { projectId: input.projectId, path: input.path, branch: input.branch, instruction: input.instruction },
    dispatch: { projectId: input.projectId, workflowId: input.workflowId, branch: input.branch, confirmed: true as const },
  };
}

export function actionsForAttachedChatSession(
  session: { projectId: number | null; repositoryId: number | null; repositoryBranch: string | null },
  fallbackBranch: string,
  input: { path: string; workflowId: number; instruction: string },
) {
  if (!session.projectId || !session.repositoryId) return null;
  return chatRepositoryActions({ projectId: session.projectId, branch: session.repositoryBranch || fallbackBranch, ...input });
}
