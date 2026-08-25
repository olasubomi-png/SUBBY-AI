import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { activityEvents, agentTasks, chatMessages, projects, workspaceFiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";

const projectStatus = z.enum(["planning", "building", "review", "paused"]);
const taskStatus = z.enum(["queued", "in_progress", "completed"]);
const chatInput = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  content: z.string().trim().min(1).max(8000),
});
const filePath = z.string().trim().min(1).max(240).regex(/^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./@+\- ]+$/, "Use a relative path without '..'.");
const fileInput = z.object({
  projectId: z.number().int().positive(),
  path: filePath,
  language: z.string().trim().min(1).max(32).default("plaintext"),
  content: z.string().max(50000).default(""),
});

function asDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).getTime() : Date.now();
}

async function appendActivity(
  userId: number,
  input: { projectId?: number | null; kind: "project" | "agent" | "chat" | "workspace"; title: string; detail?: string },
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityEvents).values({
    userId,
    projectId: input.projectId ?? null,
    kind: input.kind,
    title: input.title,
    detail: input.detail ?? null,
  });
}

async function requireProjectAccess(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const [project] = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) throw new Error("Project not found.");
  return { db, project };
}

export const workspaceRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        projects: [],
        tasks: [],
        activity: [],
        summary: { totalProjects: 0, activeProjects: 0, inProgressTasks: 0, completedTasks: 0 },
      };
    }

    const [projectRows, taskRows, activityRows] = await Promise.all([
      db.select().from(projects).where(eq(projects.userId, ctx.user.id)).orderBy(desc(projects.updatedAt)).limit(8),
      db.select().from(agentTasks).where(eq(agentTasks.userId, ctx.user.id)).orderBy(desc(agentTasks.updatedAt)).limit(12),
      db.select().from(activityEvents).where(eq(activityEvents.userId, ctx.user.id)).orderBy(desc(activityEvents.createdAt)).limit(10),
    ]);

    return {
      projects: projectRows.map((project) => ({ ...project, createdAt: asDateTime(project.createdAt), updatedAt: asDateTime(project.updatedAt) })),
      tasks: taskRows.map((task) => ({ ...task, createdAt: asDateTime(task.createdAt), updatedAt: asDateTime(task.updatedAt) })),
      activity: activityRows.map((event) => ({ ...event, createdAt: asDateTime(event.createdAt) })),
      summary: {
        totalProjects: projectRows.length,
        activeProjects: projectRows.filter((project) => project.status === "building").length,
        inProgressTasks: taskRows.filter((task) => task.status === "in_progress").length,
        completedTasks: taskRows.filter((task) => task.status === "completed").length,
      },
    };
  }),

  createProject: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).optional(), status: projectStatus.default("planning") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [result] = await db.insert(projects).values({ userId: ctx.user.id, ...input });
      const projectId = result.insertId;
      await appendActivity(ctx.user.id, { projectId, kind: "project", title: `Created ${input.name}`, detail: "Project workspace initialized" });
      return { id: projectId };
    }),

  createTask: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive().nullable().optional(), title: z.string().trim().min(2).max(180), detail: z.string().trim().max(1000).optional(), status: taskStatus.default("queued") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      if (input.projectId) {
        const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id))).limit(1);
        if (!project) throw new Error("Project not found.");
      }
      const [result] = await db.insert(agentTasks).values({ userId: ctx.user.id, ...input });
      await appendActivity(ctx.user.id, { projectId: input.projectId, kind: "agent", title: `Queued task: ${input.title}`, detail: "SUBBY Agent" });
      return { id: result.insertId };
    }),

  updateTaskStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), status: taskStatus }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [task] = await db.select().from(agentTasks).where(and(eq(agentTasks.id, input.id), eq(agentTasks.userId, ctx.user.id))).limit(1);
      if (!task) throw new Error("Task not found.");
      await db.update(agentTasks).set({ status: input.status }).where(eq(agentTasks.id, input.id));
      await appendActivity(ctx.user.id, { projectId: task.projectId, kind: "agent", title: `Task marked ${input.status.replace("_", " ")}`, detail: task.title });
      return { success: true };
    }),

  chatHistory: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive().nullable().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const projectId = input?.projectId ?? null;
      const rows = projectId
        ? await db.select().from(chatMessages).where(and(eq(chatMessages.userId, ctx.user.id), eq(chatMessages.projectId, projectId))).orderBy(chatMessages.createdAt).limit(40)
        : await db.select().from(chatMessages).where(and(eq(chatMessages.userId, ctx.user.id), isNull(chatMessages.projectId))).orderBy(chatMessages.createdAt).limit(40);
      return rows.map((message) => ({ ...message, createdAt: asDateTime(message.createdAt) }));
    }),

  askSubby: protectedProcedure
    .input(chatInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");

      const priorMessages = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.userId, ctx.user.id), input.projectId ? eq(chatMessages.projectId, input.projectId) : isNull(chatMessages.projectId)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(8);
      const chronological = [...priorMessages].reverse();

      await db.insert(chatMessages).values({ userId: ctx.user.id, projectId: input.projectId ?? null, role: "user", content: input.content });
      const { data: models } = await listLLMModels();
      const model = models.find((entry) => entry.id.startsWith("claude-"))?.id ?? models.find((entry) => entry.id.startsWith("gpt-"))?.id ?? models[0]?.id;
      const response = await invokeLLM({
        model,
        messages: [
          {
            role: "system",
            content: "You are SUBBY, an autonomous AI co-developer. Provide concise, practical coding guidance. When useful, state assumptions, propose an ordered plan, include focused code snippets, explain verification steps, and flag actions that need user approval. Never claim you executed tools, edited files, or deployed anything unless that was explicitly done by the application.",
          },
          ...chronological.map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
          { role: "user", content: input.content },
        ],
      });
      const content = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : "I could not generate a response. Please try again.";
      const [result] = await db.insert(chatMessages).values({ userId: ctx.user.id, projectId: input.projectId ?? null, role: "assistant", content });
      await appendActivity(ctx.user.id, { projectId: input.projectId, kind: "chat", title: "Asked SUBBY", detail: input.content.slice(0, 96) });
      return { id: result.insertId, content };
    }),

  listFiles: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { db } = await requireProjectAccess(ctx.user.id, input.projectId);
      const files = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.userId, ctx.user.id), eq(workspaceFiles.projectId, input.projectId))).orderBy(workspaceFiles.path);
      return files.map((file) => ({ ...file, createdAt: asDateTime(file.createdAt), updatedAt: asDateTime(file.updatedAt) }));
    }),

  createFile: protectedProcedure
    .input(fileInput)
    .mutation(async ({ ctx, input }) => {
      const { db, project } = await requireProjectAccess(ctx.user.id, input.projectId);
      const [result] = await db.insert(workspaceFiles).values({ userId: ctx.user.id, ...input });
      await appendActivity(ctx.user.id, { projectId: input.projectId, kind: "workspace", title: `Created ${input.path}`, detail: project.name });
      return { id: result.insertId };
    }),

  updateFile: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), path: filePath.optional(), language: z.string().trim().min(1).max(32).optional(), content: z.string().max(50000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [file] = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.id, input.id), eq(workspaceFiles.userId, ctx.user.id))).limit(1);
      if (!file) throw new Error("File not found.");
      const changes = { ...(input.path !== undefined ? { path: input.path } : {}), ...(input.language !== undefined ? { language: input.language } : {}), ...(input.content !== undefined ? { content: input.content } : {}) };
      if (!Object.keys(changes).length) return { success: true };
      await db.update(workspaceFiles).set(changes).where(eq(workspaceFiles.id, input.id));
      await appendActivity(ctx.user.id, { projectId: file.projectId, kind: "workspace", title: `Updated ${changes.path ?? file.path}`, detail: "Project file" });
      return { success: true };
    }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), confirmed: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [file] = await db.select().from(workspaceFiles).where(and(eq(workspaceFiles.id, input.id), eq(workspaceFiles.userId, ctx.user.id))).limit(1);
      if (!file) throw new Error("File not found.");
      await db.delete(workspaceFiles).where(eq(workspaceFiles.id, input.id));
      await appendActivity(ctx.user.id, { projectId: file.projectId, kind: "workspace", title: `Deleted ${file.path}`, detail: "Project file" });
      return { success: true };
    }),
});
