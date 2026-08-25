import { describe, expect, it } from "vitest";
import { isProtectedBranchRejection } from "./github";

describe("GitHub protected-branch safeguards", () => {
  it("detects branch-protection responses without misclassifying other forbidden errors", () => {
    expect(isProtectedBranchRejection("Protected branch update failed")).toBe(true);
    expect(isProtectedBranchRejection("Branch protection rule violation")).toBe(true);
    expect(isProtectedBranchRejection("Resource not accessible by integration")).toBe(false);
  });
});
