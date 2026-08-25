export type WorkflowRunCard = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  event: string;
  runNumber: number | null;
  url: string;
};

export type PersistedWorkflowRun = Omit<WorkflowRunCard, "id"> & { runId: number };

export function mergeWorkflowRuns(live: WorkflowRunCard[], persisted: PersistedWorkflowRun[]) {
  const merged = [...live, ...persisted.map((run) => ({ ...run, id: run.runId }))];
  return merged.filter((run, index, all) => all.findIndex((candidate) => candidate.id === run.id) === index);
}

export function reviewCommentAnchor(comment: { lineNumber: number | null; side: "old" | "new" }) {
  return comment.lineNumber ? `${comment.side} line ${comment.lineNumber}` : "File comment";
}

export function shouldShowResumeReview(reviewId: number | undefined, fileCount: number, expanded: boolean) {
  return Boolean(reviewId && fileCount > 0 && !expanded);
}

export function splitDiffRows(lines: Array<{ type: "context" | "added" | "removed" | "hunk"; text: string; oldLine?: number; newLine?: number }>) {
  return lines.map((line) => line.type === "hunk" ? { type: "hunk" as const, text: line.text } : {
    type: "row" as const,
    left: { line: line.oldLine ?? null, text: line.type === "added" ? "" : line.text, state: line.type === "removed" ? "removed" as const : "context" as const },
    right: { line: line.newLine ?? null, text: line.type === "removed" ? "" : line.text, state: line.type === "added" ? "added" as const : "context" as const },
  });
}
