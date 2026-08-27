import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { activityEvents, chatSessions, githubConnections, githubRepositories, projects, proposalReviewComments, proposalReviewFiles, proposalReviews, workflowRunSnapshots } from "../../drizzle/schema";
import { getDb } from "../db";
import { beginGitHubConnection, getGitHubConnection, getProjectRepository, getUserRepository, githubRequest, listGitHubRepositoryBranches, type GithubRepository } from "../github";
import { isGitHubOAuthConfigured } from "../githubConfig";
import { normalizeWorkflowRun, supportsManualDispatch, type GitHubWorkflowRunResponse } from "../githubWorkflow";
import { analyzeRepositoryFiles, intelligenceSummary } from "../repositoryIntelligence";
import { buildGitTreeBlobs, combinedCommitMessage, combinedSummary, normalizeReviewedChanges, type ReviewedFileChange } from "../githubChangeReview";
import { protectedProcedure, router } from "../_core/trpc";
import { completeSubbyAi } from "../providers";

const projectInput = z.object({ projectId: z.number().int().positive() });
const repositoryPath = (fullName: string) => fullName.split("/").map(encodeURIComponent).join("/");
const reviewedChangeInput = z.object({
  path: z.string().trim().min(1).max(500).regex(/^(?!.*\.\.(?:\/|$))(?!\.git(?:\/|$))[A-Za-z0-9_./@+\- ]+$/, "Use a relative repository path without '..' or '.git'."),
  content: z.string().max(100_000),
  commitMessage: z.string().trim().min(4).max(200),
  summary: z.string().trim().min(4).max(1000),
  baseSha: z.string().trim().min(1).max(200),
  baseContent: z.string().max(100_000).optional(),
});
const batchedApprovalInput = z.object({
  projectId: z.number().int().positive(),
  repositoryId: z.number().int().positive().optional(),
  branch: z.string().trim().min(1).max(255),
  changes: z.array(reviewedChangeInput).min(1).max(8),
  confirmed: z.literal(true),
});

async function repositoryText(userId: number, projectId: number, path: string, branch?: string, repositoryId?: number) {
  const repository = repositoryId ? await getUserRepository(userId, repositoryId) : await getProjectRepository(userId, projectId);
  if (!repository) throw new Error("Select a repository for this project first.");
  const file = await githubRequest<{ content?: string; encoding?: string; size?: number; name: string; sha?: string }>(userId, { url: `/repos/${repositoryPath(repository.fullName)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch ?? repository.defaultBranch)}` });
  if (file.encoding !== "base64" || !file.content || (file.size ?? 0) > 100_000) throw new Error("This file is not a supported text file for inspection.");
  return { repository, sha: file.sha, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") };
}

async function requireProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) throw new Error("Project not found.");
  return { db, project };
}

async function recordGitHubActivity(userId: number, projectId: number, title: string, detail: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityEvents).values({ userId, projectId, kind: "workspace", title, detail });
}

async function prepareReviewedChanges(userId: number, input: { projectId: number; repositoryId?: number; branch: string; changes: ReviewedFileChange[] }) {
  const repository = input.repositoryId ? await getUserRepository(userId, input.repositoryId) : await getProjectRepository(userId, input.projectId);
  if (!repository) throw new Error("Select a repository for this project first.");
  const changes = normalizeReviewedChanges(input.changes);
  if (changes.length !== input.changes.length) throw new Error("Each reviewed change must have a unique, safe repository path.");
  for (const change of changes) {
    const current = await repositoryText(userId, input.projectId, change.path, input.branch, input.repositoryId);
    if (!current.sha || current.sha !== change.baseSha) throw new Error(`The reviewed file ${change.path} changed on GitHub after it was proposed. Inspect it again before approving.`);
  }
  return { repository, changes };
}

async function commitReviewedChanges(userId: number, repository: { fullName: string; defaultBranch: string }, branch: string, changes: ReviewedFileChange[], message: string, createBranch = false) {
  const repositoryUrl = repositoryPath(repository.fullName);
  const baseRef = await githubRequest<{ object: { sha: string } }>(userId, { url: `/repos/${repositoryUrl}/git/ref/heads/${encodeURIComponent(branch)}` });
  const baseCommit = await githubRequest<{ tree: { sha: string } }>(userId, { url: `/repos/${repositoryUrl}/git/commits/${baseRef.object.sha}` });
  const blobShas: string[] = [];
  for (const change of changes) {
    const blob = await githubRequest<{ sha: string }>(userId, { method: "POST", url: `/repos/${repositoryUrl}/git/blobs`, data: { content: change.content, encoding: "utf-8" } });
    blobShas.push(blob.sha);
  }
  const tree = await githubRequest<{ sha: string }>(userId, { method: "POST", url: `/repos/${repositoryUrl}/git/trees`, data: { base_tree: baseCommit.tree.sha, tree: buildGitTreeBlobs(changes, blobShas) } });
  const commit = await githubRequest<{ sha: string }>(userId, { method: "POST", url: `/repos/${repositoryUrl}/git/commits`, data: { message, tree: tree.sha, parents: [baseRef.object.sha] } });
  const targetBranch = createBranch ? `subby/fix-${Date.now().toString(36)}` : branch;
  await githubRequest(userId, { method: createBranch ? "POST" : "PATCH", url: createBranch ? `/repos/${repositoryUrl}/git/refs` : `/repos/${repositoryUrl}/git/refs/heads/${encodeURIComponent(targetBranch)}`, data: createBranch ? { ref: `refs/heads/${targetBranch}`, sha: commit.sha } : { sha: commit.sha, force: false } });
  return { branch: targetBranch, commitSha: commit.sha };
}

export const githubRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => ({ configured: isGitHubOAuthConfigured(), connection: await getGitHubConnection(ctx.user.id) })),

  startConnection: protectedProcedure.mutation(async ({ ctx }) => ({ url: await beginGitHubConnection(ctx.user.id) })),

  disconnect: protectedProcedure
    .input(z.object({ confirmed: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      await db.delete(githubRepositories).where(eq(githubRepositories.userId, ctx.user.id));
      await db.delete(githubConnections).where(eq(githubConnections.userId, ctx.user.id));
      await db.insert(activityEvents).values({ userId: ctx.user.id, projectId: null, kind: "workspace", title: "Disconnected GitHub account", detail: "SUBBY repository access removed" });
      return { success: true };
    }),

  listRepositories: protectedProcedure.query(async ({ ctx }) => {
    const repositories = await githubRequest<GithubRepository[]>(ctx.user.id, { url: "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member" });
    return repositories.map((repo) => ({ id: repo.id, fullName: repo.full_name, name: repo.name, owner: repo.owner.login, private: repo.private, defaultBranch: repo.default_branch, updatedAt: repo.updated_at }));
  }),

  listRepositoryBranches: protectedProcedure
    .input(z.object({ fullName: z.string().trim().regex(/^[^/]+\/[^/]+$/) }))
    .query(async ({ ctx, input }) => listGitHubRepositoryBranches(ctx.user.id, input.fullName)),

  bindRepository: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), fullName: z.string().trim().regex(/^[^/]+\/[^/]+$/) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireProject(ctx.user.id, input.projectId);
      const connection = await getGitHubConnection(ctx.user.id);
      if (!connection) throw new Error("Connect GitHub before selecting a repository.");
      const repo = await githubRequest<GithubRepository>(ctx.user.id, { url: `/repos/${repositoryPath(input.fullName)}` });
      const [existingRepository] = await db.select({ id: githubRepositories.id, projectId: githubRepositories.projectId }).from(githubRepositories).where(and(eq(githubRepositories.userId, ctx.user.id), eq(githubRepositories.fullName, repo.full_name))).limit(1);
      if (!existingRepository) {
        await db.insert(githubRepositories).values({ userId: ctx.user.id, projectId: input.projectId, connectionId: connection.id, owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, isPrivate: repo.private ? 1 : 0 })
          .onDuplicateKeyUpdate({ set: { connectionId: connection.id, owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, isPrivate: repo.private ? 1 : 0 } });
      }
      await recordGitHubActivity(ctx.user.id, input.projectId, existingRepository ? "Repository already connected" : "Linked GitHub repository", `${repo.full_name}${existingRepository?.projectId && existingRepository.projectId !== input.projectId ? " · available to this chat" : ""}`);
      return { success: true, repositoryProjectId: existingRepository?.projectId ?? input.projectId };
    }),

  repositoryContext: protectedProcedure
    .input(projectInput.extend({ repositoryId: z.number().int().positive().optional(), branch: z.string().trim().min(1).max(255).optional() }))
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = input.repositoryId ? await getUserRepository(ctx.user.id, input.repositoryId) : await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) return { repository: null, files: [] as string[] };
      const branch = input.branch ?? repository.defaultBranch;
      const tree = await githubRequest<{ tree: { path: string; type: string; size?: number }[] }>(ctx.user.id, { url: `/repos/${repositoryPath(repository.fullName)}/git/trees/${encodeURIComponent(branch)}?recursive=1` });
      const files = tree.tree.filter((entry) => entry.type === "blob" && (entry.size ?? 0) <= 200_000).map((entry) => entry.path).slice(0, 250);
      return { repository: { id: repository.id, fullName: repository.fullName, defaultBranch: branch, private: repository.isPrivate === 1 }, files };
    }),

  inspectRepository: protectedProcedure
    .input(projectInput.extend({ repositoryId: z.number().int().positive().optional(), branch: z.string().trim().min(1).max(255).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = input.repositoryId ? await getUserRepository(ctx.user.id, input.repositoryId) : await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) throw new Error("Attach a repository before asking SUBBY to inspect it.");
      const branch = input.branch ?? repository.defaultBranch;
      const tree = await githubRequest<{ tree: { path: string; type: string; size?: number }[] }>(ctx.user.id, { url: `/repos/${repositoryPath(repository.fullName)}/git/trees/${encodeURIComponent(branch)}?recursive=1` });
      const files = tree.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path);
      const intelligence = analyzeRepositoryFiles(files);
      const highlights = intelligence.importantFiles.slice(0, 8);
      const extensionCounts = new Map<string, number>();
      for (const path of files) {
        const extension = path.includes(".") ? path.split(".").pop()?.toLowerCase() : undefined;
        if (extension && extension.length <= 8) extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
      }
      const technologies = Array.from(extensionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([extension, count]) => `${extension} (${count})`);
      const summary = `I inspected ${repository.fullName} on ${branch}. I found ${files.length} tracked files${technologies.length ? `, with common file types: ${technologies.join(", ")}` : ""}${highlights.length ? `. Key project files detected: ${highlights.join(", ")}` : ""}. Project intelligence: ${intelligenceSummary(intelligence)}`;
      await recordGitHubActivity(ctx.user.id, input.projectId, "Inspected repository structure", `${repository.fullName} · ${branch} · ${files.length} files · ${intelligence.languages.join(", ") || "unknown language"}`);
      return { fullName: repository.fullName, branch, fileCount: files.length, highlights, technologies, intelligence, summary };
    }),

  readRepositoryFile: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), path: z.string().trim().min(1).max(500), branch: z.string().trim().min(1).max(255).optional() }))
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const file = await repositoryText(ctx.user.id, input.projectId, input.path, input.branch, input.repositoryId);
      return { path: input.path, content: file.content };
    }),

  inspectFile: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), path: z.string().trim().min(1).max(500), branch: z.string().trim().min(1).max(255).optional(), question: z.string().trim().min(4).max(1000).default("Review this file for correctness, risks, and actionable improvements.") }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const file = await repositoryText(ctx.user.id, input.projectId, input.path, input.branch, input.repositoryId);
      const response = await completeSubbyAi({ task: "coding", messages: [{ role: "system", content: "You are SUBBY, a senior software engineer. Review only the supplied repository file. Give concise, actionable findings with severity, exact evidence, and verification steps. Do not claim that you ran tests or changed code." }, { role: "user", content: `Question: ${input.question}\n\nFile: ${input.path}\n\n\`\`\`\n${file.content}\n\`\`\`` }] });
      await recordGitHubActivity(ctx.user.id, input.projectId, "AI reviewed repository file", input.path);
      return { review: response.content };
    }),

  proposeFileFix: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), path: z.string().trim().min(1).max(500), branch: z.string().trim().min(1).max(255).optional(), instruction: z.string().trim().min(6).max(1500) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const file = await repositoryText(ctx.user.id, input.projectId, input.path, input.branch, input.repositoryId);
      const response = await completeSubbyAi({ task: "coding", responseJsonSchema: { type: "object", properties: { summary: { type: "string" }, commitMessage: { type: "string" }, content: { type: "string" } }, required: ["summary", "commitMessage", "content"], additionalProperties: false }, messages: [{ role: "system", content: "You are SUBBY, a careful senior software engineer. Return a safe targeted full-file replacement for the requested change. Preserve unrelated behavior. Never include credentials or secrets." }, { role: "user", content: `Change request: ${input.instruction}\n\nPath: ${input.path}\n\nCurrent file:\n\`\`\`\n${file.content}\n\`\`\`` }] });
      const proposal = JSON.parse(response.content) as { summary: string; commitMessage: string; content: string };
      await recordGitHubActivity(ctx.user.id, input.projectId, "AI prepared code proposal", input.path);
      return { ...proposal, path: input.path, baseSha: file.sha, baseContent: file.content };
    }),

  listWorkflows: protectedProcedure
    .input(projectInput.extend({ repositoryId: z.number().int().positive().optional(), branch: z.string().trim().min(1).max(255).optional() }))
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = input.repositoryId ? await getUserRepository(ctx.user.id, input.repositoryId) : await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) return [];
      const data = await githubRequest<{ workflows: { id: number; name: string; path: string; state: string }[] }>(ctx.user.id, { url: `/repos/${repositoryPath(repository.fullName)}/actions/workflows?per_page=50` });
      return Promise.all(data.workflows.slice(0, 50).map(async (workflow) => {
        try {
          const source = await githubRequest<{ content?: string; encoding?: string }>(ctx.user.id, { url: `/repos/${repositoryPath(repository.fullName)}/contents/${workflow.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(input.branch ?? repository.defaultBranch)}` });
          const yaml = source.encoding === "base64" && source.content ? Buffer.from(source.content.replace(/\n/g, ""), "base64").toString("utf8") : "";
          return { id: workflow.id, name: workflow.name, path: workflow.path, state: workflow.state, dispatchable: supportsManualDispatch(yaml) };
        } catch {
          return { id: workflow.id, name: workflow.name, path: workflow.path, state: workflow.state, dispatchable: false };
        }
      }));
    }),

  workflowRuns: protectedProcedure
    .input(projectInput.extend({ repositoryId: z.number().int().positive().optional(), branch: z.string().trim().min(1).max(255).optional(), workflowId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = input.repositoryId ? await getUserRepository(ctx.user.id, input.repositoryId) : await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) return [];
      const endpoint = input.workflowId ? `/repos/${repositoryPath(repository.fullName)}/actions/workflows/${input.workflowId}/runs?per_page=10` : `/repos/${repositoryPath(repository.fullName)}/actions/runs?per_page=10`;
      const query = input.branch ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}branch=${encodeURIComponent(input.branch)}` : endpoint;
      const data = await githubRequest<{ workflow_runs?: GitHubWorkflowRunResponse[] }>(ctx.user.id, { url: query });
      const runs = (data.workflow_runs ?? []).map((run) => normalizeWorkflowRun(run, input.branch ?? repository.defaultBranch));
      const db = await getDb();
      if (db) for (const run of runs) await db.insert(workflowRunSnapshots).values({ userId: ctx.user.id, projectId: input.projectId, repositoryId: input.repositoryId ?? repository.id, branch: run.branch, runId: run.id, name: run.name, status: run.status, conclusion: run.conclusion, event: run.event, runNumber: run.runNumber, url: run.url, createdAtGithub: new Date(run.createdAt), updatedAtGithub: new Date(run.updatedAt) }).onDuplicateKeyUpdate({ set: { projectId: input.projectId, repositoryId: input.repositoryId ?? repository.id, branch: run.branch, name: run.name, status: run.status, conclusion: run.conclusion, event: run.event, runNumber: run.runNumber, url: run.url, createdAtGithub: new Date(run.createdAt), updatedAtGithub: new Date(run.updatedAt), fetchedAt: new Date() } });
      return runs;
    }),
  workflowRunHistory: protectedProcedure
    .input(projectInput.extend({ repositoryId: z.number().int().positive().optional(), branch: z.string().trim().min(1).max(255).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      await requireProject(ctx.user.id, input.projectId);
      const filters = [eq(workflowRunSnapshots.userId, ctx.user.id), eq(workflowRunSnapshots.projectId, input.projectId)];
      if (input.repositoryId) filters.push(eq(workflowRunSnapshots.repositoryId, input.repositoryId));
      if (input.branch) filters.push(eq(workflowRunSnapshots.branch, input.branch));
      return db.select().from(workflowRunSnapshots).where(and(...filters)).orderBy(desc(workflowRunSnapshots.updatedAtGithub)).limit(20);
    }),
  dispatchWorkflow: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), workflowId: z.number().int().positive(), branch: z.string().trim().min(1).max(255).optional(), confirmed: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = input.repositoryId ? await getUserRepository(ctx.user.id, input.repositoryId) : await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) throw new Error("Select a repository for this project first.");
      try {
        await githubRequest(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(repository.fullName)}/actions/workflows/${input.workflowId}/dispatches`, data: { ref: input.branch ?? repository.defaultBranch } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Workflow dispatch failed.";
        if (message.includes("does not have 'workflow_dispatch'")) throw new Error("This workflow cannot be run manually. Add a workflow_dispatch trigger to its GitHub Actions YAML file, commit it, then retry.");
        throw error;
      }
      await recordGitHubActivity(ctx.user.id, input.projectId, "Dispatched GitHub Actions workflow", repository.fullName);
      return { success: true };
    }),

  createPullRequest: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), path: z.string().trim().min(1).max(500), content: z.string().max(100_000), commitMessage: z.string().trim().min(4).max(200), summary: z.string().trim().min(4).max(1000), confirmed: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const current = await repositoryText(ctx.user.id, input.projectId, input.path, undefined, input.repositoryId);
      if (!current.sha) throw new Error("GitHub did not provide the current file version.");
      const branch = `subby/fix-${Date.now().toString(36)}`;
      const baseRef = await githubRequest<{ object: { sha: string } }>(ctx.user.id, { url: `/repos/${repositoryPath(current.repository.fullName)}/git/ref/heads/${encodeURIComponent(current.repository.defaultBranch)}` });
      await githubRequest(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(current.repository.fullName)}/git/refs`, data: { ref: `refs/heads/${branch}`, sha: baseRef.object.sha } });
      await githubRequest(ctx.user.id, { method: "PUT", url: `/repos/${repositoryPath(current.repository.fullName)}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`, data: { message: input.commitMessage, content: Buffer.from(input.content, "utf8").toString("base64"), sha: current.sha, branch } });
      const pull = await githubRequest<{ html_url: string; number: number }>(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(current.repository.fullName)}/pulls`, data: { title: input.commitMessage, head: branch, base: current.repository.defaultBranch, body: `## SUBBY proposal\n\n${input.summary}\n\nCreated only after explicit user approval in SUBBY.` } });
      await recordGitHubActivity(ctx.user.id, input.projectId, "Created GitHub pull request", `#${pull.number} · ${current.repository.fullName}`);
      return { number: pull.number, url: pull.html_url, branch };
    }),

  commitApprovedChange: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), path: z.string().trim().min(1).max(500), branch: z.string().trim().min(1).max(255), content: z.string().max(100_000), commitMessage: z.string().trim().min(4).max(200), confirmed: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const current = await repositoryText(ctx.user.id, input.projectId, input.path, input.branch, input.repositoryId);
      if (!current.sha) throw new Error("GitHub did not provide the current file version.");
      await githubRequest(ctx.user.id, { method: "PUT", url: `/repos/${repositoryPath(current.repository.fullName)}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`, data: { message: input.commitMessage, content: Buffer.from(input.content, "utf8").toString("base64"), sha: current.sha, branch: input.branch } });
      await recordGitHubActivity(ctx.user.id, input.projectId, "Committed approved SUBBY change", `${current.repository.fullName} · ${input.branch} · ${input.path}`);
      return { success: true, branch: input.branch };
    }),

  getProposalReview: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [session] = await db.select().from(chatSessions).where(and(eq(chatSessions.id, input.sessionId), eq(chatSessions.userId, ctx.user.id))).limit(1);
      if (!session) throw new Error("Chat session not found.");
      const [review] = await db.select().from(proposalReviews).where(and(eq(proposalReviews.userId, ctx.user.id), eq(proposalReviews.sessionId, input.sessionId), eq(proposalReviews.state, "open"))).orderBy(desc(proposalReviews.updatedAt)).limit(1);
      if (!review) return null;
      const files = await db.select().from(proposalReviewFiles).where(eq(proposalReviewFiles.reviewId, review.id)).orderBy(proposalReviewFiles.id);
      return { id: review.id, branch: review.branch, state: review.state, files: files.map(({ id, path, content, baseContent, summary, commitMessage, baseSha, state }) => ({ id, path, content, baseContent, summary, commitMessage, baseSha, state })) };
    }),
  listProposalComments: protectedProcedure
    .input(z.object({ reviewFileId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [file] = await db.select({ id: proposalReviewFiles.id, reviewId: proposalReviewFiles.reviewId }).from(proposalReviewFiles).where(eq(proposalReviewFiles.id, input.reviewFileId)).limit(1);
      if (!file) throw new Error("Proposal file not found.");
      const [review] = await db.select({ id: proposalReviews.id }).from(proposalReviews).where(and(eq(proposalReviews.id, file.reviewId), eq(proposalReviews.userId, ctx.user.id))).limit(1);
      if (!review) throw new Error("Proposal review not found.");
      return db.select().from(proposalReviewComments).where(and(eq(proposalReviewComments.reviewFileId, input.reviewFileId), eq(proposalReviewComments.userId, ctx.user.id))).orderBy(proposalReviewComments.createdAt);
    }),
  addProposalComment: protectedProcedure
    .input(z.object({ reviewFileId: z.number().int().positive(), body: z.string().trim().min(1).max(2000), lineNumber: z.number().int().positive().max(200000).optional(), side: z.enum(["old", "new"]).default("new") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [file] = await db.select({ id: proposalReviewFiles.id, reviewId: proposalReviewFiles.reviewId }).from(proposalReviewFiles).where(eq(proposalReviewFiles.id, input.reviewFileId)).limit(1);
      if (!file) throw new Error("Proposal file not found.");
      const [review] = await db.select({ id: proposalReviews.id }).from(proposalReviews).where(and(eq(proposalReviews.id, file.reviewId), eq(proposalReviews.userId, ctx.user.id))).limit(1);
      if (!review) throw new Error("Proposal review not found.");
      const inserted = await db.insert(proposalReviewComments).values({ reviewFileId: input.reviewFileId, userId: ctx.user.id, body: input.body, lineNumber: input.lineNumber ?? null, side: input.side });
      return { id: Number(inserted[0].insertId), success: true };
    }),
  saveProposalReview: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive(), projectId: z.number().int().positive(), repositoryId: z.number().int().positive().optional(), branch: z.string().trim().min(1).max(255), reviewId: z.number().int().positive().optional(), changes: z.array(reviewedChangeInput).min(1).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [session] = await db.select().from(chatSessions).where(and(eq(chatSessions.id, input.sessionId), eq(chatSessions.userId, ctx.user.id), eq(chatSessions.projectId, input.projectId))).limit(1);
      if (!session) throw new Error("Chat session not found for this project.");
      const changes = normalizeReviewedChanges(input.changes);
      if (changes.length !== input.changes.length || changes.some((change) => !change.baseSha)) throw new Error("Each saved proposal must have a unique safe path and a source GitHub SHA.");
      let reviewId = input.reviewId;
      if (reviewId) {
        const [review] = await db.select().from(proposalReviews).where(and(eq(proposalReviews.id, reviewId), eq(proposalReviews.userId, ctx.user.id), eq(proposalReviews.sessionId, input.sessionId))).limit(1);
        if (!review) throw new Error("Proposal review not found.");
        await db.update(proposalReviews).set({ branch: input.branch, repositoryId: input.repositoryId ?? review.repositoryId, state: "open" }).where(eq(proposalReviews.id, reviewId));
      } else {
        const inserted = await db.insert(proposalReviews).values({ userId: ctx.user.id, projectId: input.projectId, sessionId: input.sessionId, repositoryId: input.repositoryId ?? null, branch: input.branch, state: "open" });
        reviewId = Number(inserted[0].insertId);
      }
      for (const change of changes) {
        await db.insert(proposalReviewFiles).values({ reviewId, path: change.path, content: change.content, baseContent: change.baseContent ?? null, summary: change.summary, commitMessage: change.commitMessage, baseSha: change.baseSha as string, state: "pending" }).onDuplicateKeyUpdate({ set: { content: change.content, baseContent: change.baseContent ?? null, summary: change.summary, commitMessage: change.commitMessage, baseSha: change.baseSha as string, state: "pending" } });
      }
      await recordGitHubActivity(ctx.user.id, input.projectId, "Saved proposal review", `${changes.length} file${changes.length === 1 ? "" : "s"} · ${input.branch}`);
      return { reviewId };
    }),
  setProposalReviewFileState: protectedProcedure
    .input(z.object({ reviewId: z.number().int().positive(), fileId: z.number().int().positive(), state: z.enum(["pending", "approved", "rejected"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [review] = await db.select().from(proposalReviews).where(and(eq(proposalReviews.id, input.reviewId), eq(proposalReviews.userId, ctx.user.id))).limit(1);
      if (!review) throw new Error("Proposal review not found.");
      await db.update(proposalReviewFiles).set({ state: input.state }).where(and(eq(proposalReviewFiles.id, input.fileId), eq(proposalReviewFiles.reviewId, input.reviewId)));
      await db.update(proposalReviews).set({ state: "open" }).where(eq(proposalReviews.id, input.reviewId));
      return { success: true, state: input.state };
    }),
  clearProposalReview: protectedProcedure
    .input(z.object({ reviewId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [review] = await db.select().from(proposalReviews).where(and(eq(proposalReviews.id, input.reviewId), eq(proposalReviews.userId, ctx.user.id))).limit(1);
      if (!review) throw new Error("Proposal review not found.");
      await db.update(proposalReviews).set({ state: "rejected" }).where(eq(proposalReviews.id, input.reviewId));
      await db.update(proposalReviewFiles).set({ state: "rejected" }).where(eq(proposalReviewFiles.reviewId, input.reviewId));
      return { success: true };
    }),
  createPullRequestBatch: protectedProcedure
    .input(batchedApprovalInput)
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const prepared = await prepareReviewedChanges(ctx.user.id, input);
      const message = combinedCommitMessage(prepared.changes);
      const commit = await commitReviewedChanges(ctx.user.id, prepared.repository, input.branch, prepared.changes, message, true);
      const pull = await githubRequest<{ html_url: string; number: number }>(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(prepared.repository.fullName)}/pulls`, data: { title: message, head: commit.branch, base: input.branch, body: `## SUBBY multi-file proposal\n\n${combinedSummary(prepared.changes)}\n\nCreated only after explicit user approval in SUBBY.\n\nFiles: ${prepared.changes.length}` } });
      await recordGitHubActivity(ctx.user.id, input.projectId, "Created multi-file GitHub pull request", `#${pull.number} · ${prepared.repository.fullName} · ${prepared.changes.length} files`);
      return { number: pull.number, url: pull.html_url, branch: commit.branch, files: prepared.changes.map((change) => change.path) };
    }),
  commitApprovedChanges: protectedProcedure
    .input(batchedApprovalInput)
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const prepared = await prepareReviewedChanges(ctx.user.id, input);
      const message = combinedCommitMessage(prepared.changes);
      const commit = await commitReviewedChanges(ctx.user.id, prepared.repository, input.branch, prepared.changes, message, false);
      await recordGitHubActivity(ctx.user.id, input.projectId, "Committed approved SUBBY changes", `${prepared.repository.fullName} · ${input.branch} · ${prepared.changes.length} files`);
      return { success: true, branch: commit.branch, commitSha: commit.commitSha, files: prepared.changes.map((change) => change.path) };
    }),
  operationHistory: protectedProcedure
    .input(projectInput)
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const entries = await db.select().from(activityEvents).where(and(eq(activityEvents.userId, ctx.user.id), eq(activityEvents.kind, "workspace"), or(eq(activityEvents.projectId, input.projectId), isNull(activityEvents.projectId)))).orderBy(desc(activityEvents.createdAt)).limit(20);
      return entries.map((entry) => ({ id: entry.id, title: entry.title, detail: entry.detail, createdAt: entry.createdAt.getTime() }));
    }),
});
