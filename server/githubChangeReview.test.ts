import { describe, expect, it } from "vitest";
import { buildGitTreeBlobs, combinedCommitMessage, combinedSummary, normalizeReviewedChanges, type ReviewedFileChange } from "./githubChangeReview";

const change = (path: string, content = path): ReviewedFileChange => ({
  path,
  content,
  commitMessage: `Update ${path}`,
  summary: `Review ${path}`,
});

describe("github change review helpers", () => {
  it("replaces duplicate paths with the newest reviewed proposal", () => {
    const result = normalizeReviewedChanges([change("src/a.ts", "old"), change("src/b.ts"), change("src/a.ts", "new")]);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.path === "src/a.ts")?.content).toBe("new");
  });

  it("filters unsafe paths and caps the review batch", () => {
    const result = normalizeReviewedChanges([change("../secret"), change(".git/config"), change("src/a.ts"), change("src/b.ts"), change("src/c.ts")], 2);
    expect(result.map((item) => item.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("builds stable blob entries and combined approval metadata", () => {
    const changes = normalizeReviewedChanges([change("src/a.ts"), change("src/b.ts")]);
    expect(buildGitTreeBlobs(changes, ["sha-a", "sha-b"])).toEqual([
      { path: "src/a.ts", mode: "100644", type: "blob", sha: "sha-a" },
      { path: "src/b.ts", mode: "100644", type: "blob", sha: "sha-b" },
    ]);
    expect(combinedCommitMessage(changes)).toBe("Update src/a.ts (+1 reviewed file)");
    expect(combinedSummary(changes)).toContain("src/b.ts: Review src/b.ts");
  });
});
