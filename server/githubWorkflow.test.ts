import { describe, expect, it } from "vitest";
import { supportsManualDispatch } from "./githubWorkflow";

describe("supportsManualDispatch", () => {
  it("recognizes a GitHub Actions workflow_dispatch trigger", () => {
    expect(supportsManualDispatch("on:\n  workflow_dispatch:\n  push:\n    branches: [main]")) .toBe(true);
  });

  it("does not treat push and pull-request-only workflows as manually dispatchable", () => {
    expect(supportsManualDispatch("on:\n  push:\n    branches: [main]\n  pull_request:")) .toBe(false);
  });
});
