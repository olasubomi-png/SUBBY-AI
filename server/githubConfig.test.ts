import { describe, expect, it } from "vitest";
import { isGitHubOAuthConfigured } from "./githubConfig";

describe("GitHub OAuth configuration", () => {
  it("authenticates the configured OAuth app against GitHub", async () => {
    const clientId = process.env.GITHUB_CLIENT_ID ?? "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? "";
    expect(isGitHubOAuthConfigured(clientId, clientSecret)).toBe(true);

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "SUBBY-AI",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: "subby-validation-code" }),
    });
    const payload = await response.json() as { error?: string };

    expect(payload.error).toBe("bad_verification_code");
  }, 20_000);
});
