import fs from "node:fs";
import { describe, expect, it } from "vitest";

const theme = fs.readFileSync(new URL("../client/src/subby-theme.css", import.meta.url), "utf8");
const entrypoint = fs.readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
const chatPage = fs.readFileSync(new URL("../client/src/pages/Chat.tsx", import.meta.url), "utf8");
const companionTools = fs.readFileSync(new URL("../client/src/pages/CompanionTools.tsx", import.meta.url), "utf8");

describe("SUBBY professional visual system", () => {
  it("defines and loads the centralized graphite, typography, indigo, violet, border, and status tokens", () => {
    expect(entrypoint).toContain('import "./subby-theme.css"');
    expect(theme).toContain("--subby-background: #0b0d12");
    expect(theme).toContain("--subby-surface: #12161f");
    expect(theme).toContain("--subby-surface-elevated: #181d27");
    expect(theme).toContain("--subby-text-primary: #f3f4f6");
    expect(theme).toContain("--subby-text-secondary: #9ca3af");
    expect(theme).toContain("--subby-primary: #6366f1");
    expect(theme).toContain("--subby-violet: #8b5cf6");
    expect(theme).toContain("--subby-border: #252b36");
    expect(theme).toContain("--subby-success: #22c55e");
    expect(theme).toContain("--subby-warning: #f59e0b");
    expect(theme).toContain("--subby-error: #ef4444");
  });

  it("uses indigo for primary and active controls, preserves meaningful status color, and avoids legacy neon token values", () => {
    expect(theme).toContain(".subby-nav-item.active");
    expect(theme).toContain("background: var(--subby-primary)");
    expect(theme).toContain(".composer-mode-switch button.active");
    expect(theme).toContain(".subby-pulse");
    expect(theme).not.toContain("#22d3ee");
    expect(theme).not.toContain("#06b6d4");
  });

  it("keeps image-brief examples aligned with the restrained graphite-and-indigo direction", () => {
    expect(chatPage).toContain("refined graphite developer workspace with soft indigo interface lighting");
    expect(companionTools).toContain("refined graphite product illustration for a developer dashboard, soft indigo accents");
    expect(chatPage).not.toContain("cyan and violet interface lighting");
    expect(companionTools).not.toContain("electric cyan and violet accents");
  });
});
