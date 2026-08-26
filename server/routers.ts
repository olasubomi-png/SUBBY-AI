import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { hashPassword, normalizeEmail, verifyPassword } from "./localAuth";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { workspaceRouter } from "./routers/workspace";
import { githubRouter } from "./routers/github";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(320), password: z.string().min(10).max(128) })).mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      if (await db.getPasswordCredential(email)) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      const user = await db.createLocalUser({ openId: `local_${crypto.randomUUID().replaceAll("-", "")}`, name: input.name.trim(), email, passwordHash: await hashPassword(input.password) });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? input.name, expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return user;
    }),
    login: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      const credential = await db.getPasswordCredential(email);
      if (!credential || !(await verifyPassword(input.password, credential.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      const user = await db.getUserById(credential.userId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? email, expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  workspace: workspaceRouter,
  github: githubRouter,
});

export type AppRouter = typeof appRouter;
