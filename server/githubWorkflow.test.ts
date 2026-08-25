import { describe, expect, it } from "vitest";
import { normalizeWorkflowRun, supportsManualDispatch } from "./githubWorkflow";

describe("supportsManualDispatch", () => {
  it("recognizes a GitHub Actions workflow_dispatch trigger", () => {
    expect(supportsManualDispatch("on:\n  workflow_dispatch:\n  push:\n    branches: [main]")) .toBe(true);
  });

  it("does not treat push and pull-request-only workflows as manually dispatchable", () => {
    expect(supportsManualDispatch("on:\n  push:\n    branches: [main]\n  pull_request:")) .toBe(false);
  });

  it("normalizes incomplete GitHub run metadata for status cards", () => {
    expect(normalizeWorkflowRun({ id: 42, display_title: "Verify build", status: "completed", conclusion: "success", html_url: "https://github.com/acme/app/actions/runs/42", created_at: "2026-08-25T12:00:00Z", updated_at: "2026-08-25T12:02:00Z" }, "main")).toMatchObject({ id: 42, name: "Verify build", branch: "main", event: "workflow", runNumber: null, conclusion: "success" });
  });
});
