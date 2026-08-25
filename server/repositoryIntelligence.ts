export type RepositoryIntelligence = {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  buildCommands: string[];
  testCommands: string[];
  lintCommands: string[];
  importantFiles: string[];
  ciFiles: string[];
  hasDocker: boolean;
  hasDatabaseSignals: boolean;
  hasEnvironmentConfig: boolean;
};

const fileExists = (files: string[], name: string) => files.some((file) => file === name || file.startsWith(`${name}/`));

export function analyzeRepositoryFiles(files: string[]): RepositoryIntelligence {
  const normalized = Array.from(new Set(files.map((file) => file.replace(/^\.\//, "").replace(/\\/g, "/"))));
  const languages = new Set<string>();
  if (normalized.some((file) => /\.(tsx?|mts|cts)$/.test(file))) languages.add("TypeScript");
  else if (normalized.some((file) => /\.jsx?$/.test(file))) languages.add("JavaScript");
  if (normalized.some((file) => /\.(py|pyi)$/.test(file))) languages.add("Python");
  if (normalized.some((file) => /\.(go)$/.test(file))) languages.add("Go");
  if (normalized.some((file) => /\.(rs)$/.test(file))) languages.add("Rust");
  if (normalized.some((file) => /\.(java|kt)$/.test(file))) languages.add("JVM");
  if (normalized.some((file) => /\.(css|scss|sass)$/.test(file))) languages.add("CSS");

  const frameworks: string[] = [];
  if (fileExists(normalized, "next.config.js") || fileExists(normalized, "next.config.ts") || fileExists(normalized, "next.config.mjs")) frameworks.push("Next.js");
  if (fileExists(normalized, "vite.config.ts") || fileExists(normalized, "vite.config.js")) frameworks.push("Vite");
  if (fileExists(normalized, "angular.json")) frameworks.push("Angular");
  if (fileExists(normalized, "nuxt.config.ts") || fileExists(normalized, "nuxt.config.js")) frameworks.push("Nuxt");
  if (fileExists(normalized, "manage.py")) frameworks.push("Django");
  if (fileExists(normalized, "artisan")) frameworks.push("Laravel");
  if (fileExists(normalized, "Cargo.toml")) frameworks.push("Cargo");

  const packageManagers: string[] = [];
  if (fileExists(normalized, "pnpm-lock.yaml")) packageManagers.push("pnpm");
  if (fileExists(normalized, "yarn.lock")) packageManagers.push("Yarn");
  if (fileExists(normalized, "package-lock.json")) packageManagers.push("npm");
  if (fileExists(normalized, "bun.lockb") || fileExists(normalized, "bun.lock")) packageManagers.push("Bun");
  if (fileExists(normalized, "poetry.lock")) packageManagers.push("Poetry");
  if (fileExists(normalized, "Pipfile.lock")) packageManagers.push("Pipenv");
  if (fileExists(normalized, "requirements.txt")) packageManagers.push("pip");
  if (fileExists(normalized, "go.mod")) packageManagers.push("Go modules");
  if (fileExists(normalized, "Cargo.lock")) packageManagers.push("Cargo");

  const buildCommands: string[] = [];
  const testCommands: string[] = [];
  const lintCommands: string[] = [];
  if (fileExists(normalized, "package.json")) {
    buildCommands.push("package.json: build script (inspect before running)");
    testCommands.push("package.json: test script (inspect before running)");
    lintCommands.push("package.json: lint/typecheck script (inspect before running)");
  }
  if (fileExists(normalized, "Makefile")) buildCommands.push("make targets (inspect before running)");
  if (fileExists(normalized, "pyproject.toml") || fileExists(normalized, "tox.ini") || fileExists(normalized, "pytest.ini")) testCommands.push("pytest configuration (inspect before running)");
  if (fileExists(normalized, "go.mod")) testCommands.push("go test ./...");
  if (fileExists(normalized, "Cargo.toml")) testCommands.push("cargo test");

  const importantNames = ["README.md", "package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml", "Makefile", "Dockerfile"];
  const importantFiles = importantNames.filter((name) => fileExists(normalized, name));
  const ciFiles = normalized.filter((file) => file.startsWith(".github/workflows/") || file === ".gitlab-ci.yml" || file === "Jenkinsfile" || file === ".circleci/config.yml").slice(0, 20);

  return {
    languages: Array.from(languages),
    frameworks,
    packageManagers,
    buildCommands,
    testCommands,
    lintCommands,
    importantFiles,
    ciFiles,
    hasDocker: fileExists(normalized, "Dockerfile") || fileExists(normalized, "docker-compose.yml") || fileExists(normalized, "compose.yml"),
    hasDatabaseSignals: normalized.some((file) => /(^|\/)(drizzle|prisma|migrations|alembic|schema|knexfile|sequelize)/i.test(file)) || normalized.some((file) => /(^|\/)(docker-compose|compose)\.(yml|yaml)$/.test(file)),
    hasEnvironmentConfig: normalized.some((file) => /(^|\/)(\.env\.example|\.env\.sample|config|configs)($|\/|\.)/i.test(file)),
  };
}

export function intelligenceSummary(intelligence: RepositoryIntelligence): string {
  const sections = [
    intelligence.languages.length ? `Languages: ${intelligence.languages.join(", ")}` : undefined,
    intelligence.frameworks.length ? `Frameworks: ${intelligence.frameworks.join(", ")}` : undefined,
    intelligence.packageManagers.length ? `Package managers: ${intelligence.packageManagers.join(", ")}` : undefined,
    intelligence.importantFiles.length ? `Important files: ${intelligence.importantFiles.join(", ")}` : undefined,
    intelligence.ciFiles.length ? `CI/CD: ${intelligence.ciFiles.length} workflow/config file${intelligence.ciFiles.length === 1 ? "" : "s"}` : undefined,
    intelligence.hasDocker ? "Docker: detected" : undefined,
    intelligence.hasDatabaseSignals ? "Database signals: detected" : undefined,
    intelligence.hasEnvironmentConfig ? "Environment configuration: detected" : undefined,
  ].filter(Boolean);
  return sections.join(" · ") || "No common project intelligence signals were detected from the file tree.";
}
