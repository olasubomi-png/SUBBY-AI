import { describe, expect, it } from "vitest";
import { mergeWorkflowRuns, reviewCommentAnchor, shouldShowResumeReview, splitDiffRows } from "../client/src/lib/reviewPresentation";

describe("review presentation helpers", () => {
  it("merges persisted workflow runs without duplicating a live run", () => {
    const result = mergeWorkflowRuns(
      [{ id: 7, name: "CI", status: "completed", conclusion: "success", branch: "main", event: "push", runNumber: 4, url: "https://github.com/run/7" }],
      [
        { runId: 7, name: "CI", status: "completed", conclusion: "success", branch: "main", event: "push", runNumber: 4, url: "https://github.com/run/7" },
        { runId: 6, name: "CI", status: "completed", conclusion: "failure", branch: "main", event: "push", runNumber: 3, url: "https://github.com/run/6" },
      ],
    );
    expect(result).toHaveLength(2);
    expect(result.map((run) => run.id)).toEqual([7, 6]);
  });

  it("formats inline comment anchors and file-level comments", () => {
    expect(reviewCommentAnchor({ lineNumber: 18, side: "new" })).toBe("new line 18");
    expect(reviewCommentAnchor({ lineNumber: null, side: "old" })).toBe("File comment");
  });

  it("shows resume review only for a saved collapsed review", () => {
    expect(shouldShowResumeReview(12, 2, false)).toBe(true);
    expect(shouldShowResumeReview(12, 2, true)).toBe(false);
    expect(shouldShowResumeReview(undefined, 2, false)).toBe(false);
  });

  it("maps unified diff lines into side-by-side cells", () => {
    const rows = splitDiffRows([
      { type: "hunk", text: "@@ review context @@" },
      { type: "removed", text: "old", oldLine: 3 },
      { type: "added", text: "new", newLine: 3 },
      { type: "context", text: "same", oldLine: 4, newLine: 4 },
    ]);
    expect(rows[0]).toEqual({ type: "hunk", text: "@@ review context @@" });
    expect(rows[1]).toMatchObject({ type: "row", left: { line: 3, text: "old", state: "removed" }, right: { line: null, text: "", state: "context" } });
    expect(rows[2]).toMatchObject({ type: "row", left: { line: null, text: "", state: "context" }, right: { line: 3, text: "new", state: "added" } });
  });
});
