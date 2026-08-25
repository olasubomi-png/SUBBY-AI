import { describe, expect, it } from "vitest";
import { analyzeRepositoryFiles, intelligenceSummary } from "./repositoryIntelligence";

describe("repository intelligence", () => {
  it("detects common languages, frameworks, package managers, CI, Docker, and config signals", () => {
    const result = analyzeRepositoryFiles([
      "README.md",
      "package.json",
      "pnpm-lock.yaml",
      "src/main.tsx",
      "vite.config.ts",
      "Dockerfile",
      ".env.example",
      ".github/workflows/ci.yml",
      "drizzle/schema.ts",
      "src/main.tsx",
    ]);

    expect(result.languages).toEqual(["TypeScript"]);
    expect(result.frameworks).toEqual(["Vite"]);
    expect(result.packageManagers).toEqual(["pnpm"]);
    expect(result.importantFiles).toEqual(["README.md", "package.json", "pnpm-lock.yaml", "Dockerfile"]);
    expect(result.ciFiles).toEqual([".github/workflows/ci.yml"]);
    expect(result.hasDocker).toBe(true);
    expect(result.hasDatabaseSignals).toBe(true);
    expect(result.hasEnvironmentConfig).toBe(true);
    expect(intelligenceSummary(result)).toContain("Frameworks: Vite");
  });

  it("returns explicit empty signals for an unclassified repository tree", () => {
    const result = analyzeRepositoryFiles(["LICENSE", "assets/logo.svg"]);
    expect(result.languages).toEqual([]);
    expect(result.frameworks).toEqual([]);
    expect(result.packageManagers).toEqual([]);
    expect(result.ciFiles).toEqual([]);
    expect(result.hasDocker).toBe(false);
    expect(intelligenceSummary(result)).toContain("No common project intelligence signals");
  });
});
