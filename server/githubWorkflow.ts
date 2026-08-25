export function supportsManualDispatch(workflowYaml: string) {
  return /(^|\n)\s*workflow_dispatch\s*:/m.test(workflowYaml);
}

export type GitHubWorkflowRunResponse = { id: number; name?: string; display_title?: string; status: string; conclusion: string | null; head_branch?: string; event?: string; run_number?: number; html_url: string; created_at: string; updated_at: string };

export function normalizeWorkflowRun(run: GitHubWorkflowRunResponse, fallbackBranch: string) {
  return { id: run.id, name: run.name ?? run.display_title ?? "GitHub Actions run", status: run.status, conclusion: run.conclusion, branch: run.head_branch ?? fallbackBranch, event: run.event ?? "workflow", runNumber: run.run_number ?? null, url: run.html_url, createdAt: run.created_at, updatedAt: run.updated_at };
}
