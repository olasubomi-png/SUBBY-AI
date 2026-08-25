import { createHash, randomBytes } from "node:crypto";
import axios from "axios";
import type { Express, Request } from "express";
import { and, eq } from "drizzle-orm";
import { activityEvents, githubConnections, githubOAuthStates, githubRepositories } from "../drizzle/schema";
import { getDb } from "./db";
import { decryptProjectSecret, encryptProjectSecret } from "./projectSecrets";
import { isGitHubOAuthConfigured } from "./githubConfig";
import { sdk } from "./_core/sdk";

const defaultGitHubOAuthCallbackUrl = "https://subbyai-nzrssmce.manus.space/api/github/callback";
export function getGitHubOAuthCallbackUrl(value = process.env.GITHUB_OAUTH_CALLBACK_URL) {
  return value ?? defaultGitHubOAuthCallbackUrl;
}
export const githubOAuthCallbackUrl = getGitHubOAuthCallbackUrl();
const githubApi = axios.create({ baseURL: "https://api.github.com", timeout: 20_000, headers: { Accept: "application/vnd.github+json", "User-Agent": "SUBBY-AI", "X-GitHub-Api-Version": "2022-11-28" } });

type TokenResult = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
type GithubUser = { login: string };
export type GithubRepository = { id: number; full_name: string; name: string; private: boolean; default_branch: string; owner: { login: string }; updated_at: string };

function base64Url(bytes: Buffer) { return bytes.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function codeChallenge(verifier: string) { return base64Url(createHash("sha256").update(verifier).digest()); }

async function exchangeToken(params: Record<string, string>) {
  const response = await axios.post<TokenResult>("https://github.com/login/oauth/access_token", new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID ?? "", client_secret: process.env.GITHUB_CLIENT_SECRET ?? "", ...params }).toString(), { headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SUBBY-AI" }, timeout: 20_000 });
  if (!response.data.access_token) throw new Error(response.data.error_description || "GitHub authorization could not be completed.");
  return response.data;
}

async function saveConnection(userId: number, login: string, token: TokenResult) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  if (!token.access_token) throw new Error("GitHub did not return an access token.");
  const access = encryptProjectSecret(token.access_token);
  const refresh = token.refresh_token ? encryptProjectSecret(token.refresh_token) : null;
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
  await db.insert(githubConnections).values({ userId, githubLogin: login, tokenCiphertext: access.ciphertext, tokenIv: access.iv, tokenAuthTag: access.authTag, refreshCiphertext: refresh?.ciphertext ?? null, refreshIv: refresh?.iv ?? null, refreshAuthTag: refresh?.authTag ?? null, expiresAt })
    .onDuplicateKeyUpdate({ set: { githubLogin: login, tokenCiphertext: access.ciphertext, tokenIv: access.iv, tokenAuthTag: access.authTag, refreshCiphertext: refresh?.ciphertext ?? null, refreshIv: refresh?.iv ?? null, refreshAuthTag: refresh?.authTag ?? null, expiresAt } });
}

export async function beginGitHubConnection(userId: number) {
  if (!isGitHubOAuthConfigured()) throw new Error("GitHub OAuth is not configured yet.");
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const state = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(48));
  await db.insert(githubOAuthStates).values({ userId, stateHash: hash(state), codeVerifier: verifier, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", githubOAuthCallbackUrl);
  url.searchParams.set("scope", "repo workflow read:user offline_access");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function githubAccessToken(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const [connection] = await db.select().from(githubConnections).where(eq(githubConnections.userId, userId)).limit(1);
  if (!connection) throw new Error("Connect GitHub before using repository tools.");
  if (connection.expiresAt && connection.expiresAt.getTime() < Date.now()) {
    if (!connection.refreshCiphertext || !connection.refreshIv || !connection.refreshAuthTag) throw new Error("Your GitHub connection expired. Please reconnect.");
    const refreshToken = decryptProjectSecret({ ciphertext: connection.refreshCiphertext, iv: connection.refreshIv, authTag: connection.refreshAuthTag });
    const refreshed = await exchangeToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    await saveConnection(userId, connection.githubLogin, refreshed);
    return refreshed.access_token as string;
  }
  return decryptProjectSecret({ ciphertext: connection.tokenCiphertext, iv: connection.tokenIv, authTag: connection.tokenAuthTag });
}

export async function githubRequest<T>(userId: number, config: { method?: "GET" | "POST" | "PUT" | "PATCH"; url: string; data?: unknown }) {
  const token = await githubAccessToken(userId);
  try {
    const response = await githubApi.request<T>({ method: config.method ?? "GET", url: config.url, data: config.data, headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) throw new Error("Your GitHub connection is no longer valid. Please reconnect.");
    if (axios.isAxiosError(error) && error.response?.status === 422) {
      const data = error.response.data as { message?: string } | undefined;
      throw new Error(data?.message ? `GitHub rejected this action: ${data.message}` : "GitHub rejected this action. The workflow may not allow manual dispatch.");
    }
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const data = error.response.data as { message?: string } | undefined;
      const message = data?.message ?? "GitHub denied this write operation.";
      if (isProtectedBranchRejection(message)) throw new Error(`GitHub blocked the protected branch update: ${message}. Use the approved pull-request option instead, or update the repository’s branch protection rules.`);
      throw new Error(`GitHub denied this operation: ${message}. Check the connected account permissions and repository access, then retry.`);
    }
    throw error;
  }
}

export async function listGitHubRepositoryBranches(userId: number, fullName: string) {
  const branches = await githubRequest<{ name: string }[]>(userId, { url: `/repos/${fullName.split("/").map(encodeURIComponent).join("/")}/branches?per_page=100` });
  return branches.map((branch) => branch.name);
}

export function isProtectedBranchRejection(message: string) {
  return /(protected branch|branch protection|protected refs|required status checks|protected ref)/i.test(message);
}

export async function registerGitHubOAuthRoutes(app: Express) {
  app.get("/api/github/callback", async (req: Request, res) => {
    let callbackUserId: number | null = null;
    const sessionUser = await sdk.authenticateRequest(req).catch(() => null);
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) throw new Error("GitHub did not return a complete authorization response.");
      const db = await getDb();
      if (!db) throw new Error("Workspace storage is currently unavailable.");
      const [record] = await db.select().from(githubOAuthStates).where(eq(githubOAuthStates.stateHash, hash(state))).limit(1);
      if (!record || record.expiresAt.getTime() < Date.now()) throw new Error("This GitHub connection request expired. Please try again.");
      callbackUserId = record.userId;
      await db.delete(githubOAuthStates).where(eq(githubOAuthStates.id, record.id));
      const token = await exchangeToken({ code, redirect_uri: githubOAuthCallbackUrl, code_verifier: record.codeVerifier });
      const user = await githubApi.get<GithubUser>("/user", { headers: { Authorization: `Bearer ${token.access_token}` } });
      await saveConnection(record.userId, user.data.login, token);
      await db.insert(activityEvents).values({ userId: record.userId, projectId: null, kind: "workspace", title: "Connected GitHub account", detail: `@${user.data.login}` });
      res.redirect("/github?connected=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub connection failed.";
      const historyUserId = callbackUserId ?? sessionUser?.id ?? null;
      if (historyUserId) {
        const db = await getDb();
        if (db) await db.insert(activityEvents).values({ userId: historyUserId, projectId: null, kind: "workspace", title: "GitHub connection failed", detail: message.slice(0, 180) });
      }
      res.redirect(`/github?github_error=${encodeURIComponent(message.slice(0, 140))}`);
    }
  });
}

export async function getGitHubConnection(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const [connection] = await db.select({ id: githubConnections.id, githubLogin: githubConnections.githubLogin, expiresAt: githubConnections.expiresAt, updatedAt: githubConnections.updatedAt }).from(githubConnections).where(eq(githubConnections.userId, userId)).limit(1);
  return connection ?? null;
}

export async function getProjectRepository(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const [repository] = await db.select().from(githubRepositories).where(and(eq(githubRepositories.userId, userId), eq(githubRepositories.projectId, projectId))).limit(1);
  return repository ?? null;
}

export async function getUserRepository(userId: number, repositoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is currently unavailable.");
  const [repository] = await db.select().from(githubRepositories).where(and(eq(githubRepositories.userId, userId), eq(githubRepositories.id, repositoryId))).limit(1);
  return repository ?? null;
}
