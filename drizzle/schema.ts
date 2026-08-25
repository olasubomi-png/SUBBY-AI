import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["planning", "building", "review", "paused"]).default("planning").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentTasks = mysqlTable("agentTasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  title: varchar("title", { length: 180 }).notNull(),
  detail: text("detail"),
  status: mysqlEnum("status", ["queued", "in_progress", "completed"]).default("queued").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const activityEvents = mysqlTable("activityEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  kind: mysqlEnum("kind", ["project", "agent", "chat", "workspace"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  detail: varchar("detail", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),
  projectId: int("projectId"),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatSessions = mysqlTable("chatSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  repositoryId: int("repositoryId"),
  repositoryBranch: varchar("repositoryBranch", { length: 255 }),
  title: varchar("title", { length: 140 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const workspaceFiles = mysqlTable("workspaceFiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  path: varchar("path", { length: 240 }).notNull(),
  language: varchar("language", { length: 32 }).default("plaintext").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("workspaceFiles_project_path_unique").on(table.projectId, table.path)]);

export const repositoryProfiles = mysqlTable("repositoryProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  remoteUrl: varchar("remoteUrl", { length: 500 }),
  defaultBranch: varchar("defaultBranch", { length: 120 }).default("main").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("repositoryProfiles_project_unique").on(table.projectId)]);

export const commandDrafts = mysqlTable("commandDrafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  command: varchar("command", { length: 500 }).notNull(),
  description: varchar("description", { length: 1000 }),
  state: mysqlEnum("state", ["draft", "review", "ready"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deploymentPlans = mysqlTable("deploymentPlans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  environment: mysqlEnum("environment", ["development", "staging", "production"]).notNull(),
  targetUrl: varchar("targetUrl", { length: 500 }),
  state: mysqlEnum("state", ["planned", "ready", "released"]).default("planned").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mediaAssets = mysqlTable("mediaAssets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  kind: mysqlEnum("kind", ["image"]).default("image").notNull(),
  prompt: text("prompt").notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const proposalReviews = mysqlTable("proposalReviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  sessionId: int("sessionId").notNull(),
  repositoryId: int("repositoryId"),
  branch: varchar("branch", { length: 255 }).notNull(),
  state: mysqlEnum("state", ["open", "approved", "rejected", "expired"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const proposalReviewFiles = mysqlTable("proposalReviewFiles", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  content: text("content").notNull(),
  baseContent: text("baseContent"),
  summary: varchar("summary", { length: 1000 }).notNull(),
  commitMessage: varchar("commitMessage", { length: 200 }).notNull(),
  baseSha: varchar("baseSha", { length: 200 }).notNull(),
  state: mysqlEnum("state", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("proposalReviewFiles_review_path_unique").on(table.reviewId, table.path)]);

export const workflowRunSnapshots = mysqlTable("workflowRunSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  repositoryId: int("repositoryId"),
  branch: varchar("branch", { length: 255 }).notNull(),
  runId: int("runId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  conclusion: varchar("conclusion", { length: 32 }),
  event: varchar("event", { length: 64 }),
  runNumber: int("runNumber"),
  url: varchar("url", { length: 1000 }).notNull(),
  createdAtGithub: timestamp("createdAtGithub").notNull(),
  updatedAtGithub: timestamp("updatedAtGithub").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("workflowRunSnapshots_user_repo_run_unique").on(table.userId, table.repositoryId, table.runId)]);

export const proposalReviewComments = mysqlTable("proposalReviewComments", {
  id: int("id").autoincrement().primaryKey(),
  reviewFileId: int("reviewFileId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  lineNumber: int("lineNumber"),
  side: mysqlEnum("side", ["old", "new"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectSecrets = mysqlTable("projectSecrets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  authTag: varchar("authTag", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("projectSecrets_project_name_unique").on(table.projectId, table.name)]);

export const githubConnections = mysqlTable("githubConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  githubLogin: varchar("githubLogin", { length: 120 }).notNull(),
  tokenCiphertext: text("tokenCiphertext").notNull(),
  tokenIv: varchar("tokenIv", { length: 64 }).notNull(),
  tokenAuthTag: varchar("tokenAuthTag", { length: 64 }).notNull(),
  refreshCiphertext: text("refreshCiphertext"),
  refreshIv: varchar("refreshIv", { length: 64 }),
  refreshAuthTag: varchar("refreshAuthTag", { length: 64 }),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const githubOAuthStates = mysqlTable("githubOAuthStates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stateHash: varchar("stateHash", { length: 128 }).notNull().unique(),
  codeVerifier: varchar("codeVerifier", { length: 160 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const githubRepositories = mysqlTable("githubRepositories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull().unique(),
  connectionId: int("connectionId").notNull(),
  owner: varchar("owner", { length: 120 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  fullName: varchar("fullName", { length: 300 }).notNull(),
  defaultBranch: varchar("defaultBranch", { length: 120 }).notNull(),
  isPrivate: int("isPrivate").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("githubRepositories_connection_full_name_unique").on(table.connectionId, table.fullName)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
