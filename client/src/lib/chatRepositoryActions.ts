export function chatRepositoryActions(input: { projectId: number; repositoryId?: number; branch: string; path: string; workflowId: number; instruction: string }) {
  return {
    inspect: { projectId: input.projectId, repositoryId: input.repositoryId, path: input.path, branch: input.branch },
    propose: { projectId: input.projectId, repositoryId: input.repositoryId, path: input.path, branch: input.branch, instruction: input.instruction },
    dispatch: { projectId: input.projectId, repositoryId: input.repositoryId, workflowId: input.workflowId, branch: input.branch, confirmed: true as const },
  };
}

export type ReviewableFileProposal = { id?: number; path: string; content: string; baseContent?: string | null; summary: string; commitMessage: string; baseSha?: string; state?: "pending" | "approved" | "rejected" };

export type UnifiedDiffLine = { type: "context" | "added" | "removed" | "hunk"; text: string; oldLine?: number; newLine?: number };

export function buildUnifiedDiff(baseContent: string | undefined, nextContent: string, context = 3) {
  const before = (baseContent ?? "").split(/\r?\n/);
  const after = nextContent.split(/\r?\n/);
  const operations: UnifiedDiffLine[] = [];
  const maxCells = 360_000;
  if (before.length * after.length > maxCells) {
    before.forEach((text, index) => operations.push({ type: "removed", text, oldLine: index + 1 }));
    after.forEach((text, index) => operations.push({ type: "added", text, newLine: index + 1 }));
  } else {
    const table = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));
    for (let row = before.length - 1; row >= 0; row -= 1) {
      for (let column = after.length - 1; column >= 0; column -= 1) table[row][column] = before[row] === after[column] ? table[row + 1][column + 1] + 1 : Math.max(table[row + 1][column], table[row][column + 1]);
    }
    let row = 0;
    let column = 0;
    while (row < before.length || column < after.length) {
      if (row < before.length && column < after.length && before[row] === after[column]) { operations.push({ type: "context", text: before[row], oldLine: row + 1, newLine: column + 1 }); row += 1; column += 1; }
      else if (row < before.length && (column >= after.length || table[row + 1][column] >= table[row][column + 1])) { operations.push({ type: "removed", text: before[row], oldLine: row + 1 }); row += 1; }
      else { operations.push({ type: "added", text: after[column], newLine: column + 1 }); column += 1; }
    }
  }
  const changed = operations.map((line, index) => line.type === "context" ? -1 : index).filter((index) => index >= 0);
  if (changed.length === 0) return { lines: operations.slice(0, Math.max(1, Math.min(operations.length, context * 2 + 1))), additions: 0, removals: 0 };
  const included = new Set<number>();
  changed.forEach((index) => { for (let offset = Math.max(0, index - context); offset <= Math.min(operations.length - 1, index + context); offset += 1) included.add(offset); });
  const lines: UnifiedDiffLine[] = [];
  let previous = -2;
  for (const index of Array.from(included).sort((left, right) => left - right)) {
    if (index !== previous + 1) lines.push({ type: "hunk", text: "@@ review context @@" });
    lines.push(operations[index]);
    previous = index;
  }
  return { lines, additions: operations.filter((line) => line.type === "added").length, removals: operations.filter((line) => line.type === "removed").length };
}

export function upsertReviewProposal(proposals: ReviewableFileProposal[], proposal: ReviewableFileProposal) {
  return [...proposals.filter((item) => item.path !== proposal.path), proposal];
}

export function updateReviewProposalState(proposals: ReviewableFileProposal[], path: string, state: "pending" | "approved" | "rejected") {
  return proposals.map((proposal) => proposal.path === path ? { ...proposal, state } : proposal);
}

export function selectReviewProposal(proposals: ReviewableFileProposal[], selectedPath: string) {
  return proposals.find((proposal) => proposal.path === selectedPath) ?? proposals[0];
}

export function clearReviewQueue() {
  return { proposals: [] as ReviewableFileProposal[], selectedPath: "" };
}

export function batchApprovalActions(input: { projectId: number; repositoryId?: number; branch: string; proposals: ReviewableFileProposal[] }) {
  const changes = input.proposals.filter((proposal): proposal is ReviewableFileProposal & { baseSha: string } => proposal.state === "approved" && Boolean(proposal.baseSha)).map(({ path, content, summary, commitMessage, baseSha }) => ({ path, content, summary, commitMessage, baseSha }));
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
