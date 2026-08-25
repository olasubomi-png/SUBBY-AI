import { describe, expect, it } from "vitest";
import { getGitHubOAuthCallbackUrl, isProtectedBranchRejection } from "./github";

describe("GitHub protected-branch safeguards", () => {
  it("detects branch-protection responses without misclassifying other forbidden errors", () => {
    expect(isProtectedBranchRejection("Protected branch update failed")).toBe(true);
    expect(isProtectedBranchRejection("Branch protection rule violation")).toBe(true);
    expect(isProtectedBranchRejection("Resource not accessible by integration")).toBe(false);
  });
});

describe("GitHub OAuth callback configuration", () => {
  it("supports a VPS callback override and preserves the hosted default", () => {
    expect(getGitHubOAuthCallbackUrl("http://54.167.96.219:3001/api/github/callback")).toBe("http://54.167.96.219:3001/api/github/callback");
    expect(getGitHubOAuthCallbackUrl(undefined)).toBe("https://subbyai-nzrssmce.manus.space/api/github/callback");
  });
});
