import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { activityEvents, githubConnections, githubRepositories, projects } from "../../drizzle/schema";
import { getDb } from "../db";
import { beginGitHubConnection, getGitHubConnection, getProjectRepository, githubRequest, type GithubRepository } from "../github";
import { isGitHubOAuthConfigured } from "../githubConfig";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";

const projectInput = z.object({ projectId: z.number().int().positive() });
const repositoryPath = (fullName: string) => fullName.split("/").map(encodeURIComponent).join("/");

async function repositoryText(userId: number, projectId: number, path: string) {
  const repository = await getProjectRepository(userId, projectId);
  if (!repository) throw new Error("Select a repository for this project first.");
  const file = await githubRequest<{ content?: string; encoding?: string; size?: number; name: string; sha?: string }>(userId, { url: `/repos/${repositoryPath(repository.fullName)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repository.defaultBranch)}` });
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

  bindRepository: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), fullName: z.string().trim().regex(/^[^/]+\/[^/]+$/) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireProject(ctx.user.id, input.projectId);
      const connection = await getGitHubConnection(ctx.user.id);
      if (!connection) throw new Error("Connect GitHub before selecting a repository.");
      const repo = await githubRequest<GithubRepository>(ctx.user.id, { url: `/repos/${repositoryPath(input.fullName)}` });
      await db.insert(githubRepositories).values({ userId: ctx.user.id, projectId: input.projectId, connectionId: connection.id, owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, isPrivate: repo.private ? 1 : 0 })
        .onDuplicateKeyUpdate({ set: { connectionId: connection.id, owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, isPrivate: repo.private ? 1 : 0 } });
      await recordGitHubActivity(ctx.user.id, input.projectId, "Linked GitHub repository", repo.full_name);
      return { success: true };
    }),

  repositoryContext: protectedProcedure
    .input(projectInput)
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) return { repository: null, files: [] as string[] };
      const tree = await githubRequest<{ tree: { path: string; type: string; size?: number }[] }>(ctx.user.id, { url: `/repos/${repositoryPath(repository.fullName)}/git/trees/${encodeURIComponent(repository.defaultBranch)}?recursive=1` });
      const files = tree.tree.filter((entry) => entry.type === "blob" && (entry.size ?? 0) <= 200_000).map((entry) => entry.path).slice(0, 250);
      return { repository: { id: repository.id, fullName: repository.fullName, defaultBranch: repository.defaultBranch, private: repository.isPrivate === 1 }, files };
    }),

  readRepositoryFile: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), path: z.string().trim().min(1).max(500) }))
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const file = await repositoryText(ctx.user.id, input.projectId, input.path);
      return { path: input.path, content: file.content };
    }),

  inspectFile: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), path: z.string().trim().min(1).max(500), question: z.string().trim().min(4).max(1000).default("Review this file for correctness, risks, and actionable improvements.") }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const file = await repositoryText(ctx.user.id, input.projectId, input.path);
      const { data: models } = await listLLMModels();
      const model = models.find((entry) => entry.id.startsWith("claude-"))?.id ?? models.find((entry) => entry.id.startsWith("gpt-"))?.id ?? models[0]?.id;
      const response = await invokeLLM({ model, messages: [{ role: "system", content: "You are SUBBY, a senior software engineer. Review only the supplied repository file. Give concise, actionable findings with severity, exact evidence, and verification steps. Do not claim that you ran tests or changed code." }, { role: "user", content: `Question: ${input.question}\n\nFile: ${input.path}\n\n\`\`\`\n${file.content}\n\`\`\`` }] });
      await recordGitHubActivity(ctx.user.id, input.projectId, "AI reviewed repository file", input.path);
      return { review: typeof response.choices[0]?.message?.content === "string" ? response.choices[0].message.content : "No review was generated." };
    }),

  proposeFileFix: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), path: z.string().trim().min(1).max(500), instruction: z.string().trim().min(6).max(1500) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const file = await repositoryText(ctx.user.id, input.projectId, input.path);
      const { data: models } = await listLLMModels();
      const model = models.find((entry) => entry.id.startsWith("claude-"))?.id ?? models.find((entry) => entry.id.startsWith("gpt-"))?.id ?? models[0]?.id;
      const response = await invokeLLM({ model, response_format: { type: "json_schema", json_schema: { name: "subby_file_fix", strict: true, schema: { type: "object", properties: { summary: { type: "string" }, commitMessage: { type: "string" }, content: { type: "string" } }, required: ["summary", "commitMessage", "content"], additionalProperties: false } } }, messages: [{ role: "system", content: "You are SUBBY, a careful senior software engineer. Return a safe targeted full-file replacement for the requested change. Preserve unrelated behavior. Never include credentials or secrets." }, { role: "user", content: `Change request: ${input.instruction}\n\nPath: ${input.path}\n\nCurrent file:\n\`\`\`\n${file.content}\n\`\`\`` }] });
      const content = response.choices[0]?.message?.content;
      if (typeof content !== "string") throw new Error("SUBBY could not produce a structured code proposal.");
      const proposal = JSON.parse(content) as { summary: string; commitMessage: string; content: string };
      await recordGitHubActivity(ctx.user.id, input.projectId, "AI prepared code proposal", input.path);
      return { ...proposal, path: input.path };
    }),

  listWorkflows: protectedProcedure
    .input(projectInput)
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) return [];
      const data = await githubRequest<{ workflows: { id: number; name: string; path: string; state: string }[] }>(ctx.user.id, { url: `/repos/${repositoryPath(repository.fullName)}/actions/workflows?per_page=50` });
      return data.workflows.map((workflow) => ({ id: workflow.id, name: workflow.name, path: workflow.path, state: workflow.state }));
    }),

  dispatchWorkflow: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), workflowId: z.number().int().positive(), confirmed: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const repository = await getProjectRepository(ctx.user.id, input.projectId);
      if (!repository) throw new Error("Select a repository for this project first.");
      await githubRequest(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(repository.fullName)}/actions/workflows/${input.workflowId}/dispatches`, data: { ref: repository.defaultBranch } });
      await recordGitHubActivity(ctx.user.id, input.projectId, "Dispatched GitHub Actions workflow", repository.fullName);
      return { success: true };
    }),

  createPullRequest: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive(), path: z.string().trim().min(1).max(500), content: z.string().max(100_000), commitMessage: z.string().trim().min(4).max(200), summary: z.string().trim().min(4).max(1000), confirmed: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.user.id, input.projectId);
      const current = await repositoryText(ctx.user.id, input.projectId, input.path);
      if (!current.sha) throw new Error("GitHub did not provide the current file version.");
      const branch = `subby/fix-${Date.now().toString(36)}`;
      const baseRef = await githubRequest<{ object: { sha: string } }>(ctx.user.id, { url: `/repos/${repositoryPath(current.repository.fullName)}/git/ref/heads/${encodeURIComponent(current.repository.defaultBranch)}` });
      await githubRequest(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(current.repository.fullName)}/git/refs`, data: { ref: `refs/heads/${branch}`, sha: baseRef.object.sha } });
      await githubRequest(ctx.user.id, { method: "PUT", url: `/repos/${repositoryPath(current.repository.fullName)}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`, data: { message: input.commitMessage, content: Buffer.from(input.content, "utf8").toString("base64"), sha: current.sha, branch } });
      const pull = await githubRequest<{ html_url: string; number: number }>(ctx.user.id, { method: "POST", url: `/repos/${repositoryPath(current.repository.fullName)}/pulls`, data: { title: input.commitMessage, head: branch, base: current.repository.defaultBranch, body: `## SUBBY proposal\n\n${input.summary}\n\nCreated only after explicit user approval in SUBBY.` } });
      await recordGitHubActivity(ctx.user.id, input.projectId, "Created GitHub pull request", `#${pull.number} · ${current.repository.fullName}`);
      return { url: pull.html_url, number: pull.number, branch };
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
