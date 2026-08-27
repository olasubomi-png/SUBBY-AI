import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => children }));

import { AIChatBox } from "../client/src/components/AIChatBox";

describe("AIChatBox composer actions", () => {
  it("renders a functional action slot beside the message composer without allowing message content to overflow", () => {
    const html = renderToStaticMarkup(createElement(AIChatBox, {
      messages: [{ role: "assistant", content: "A long repository response with `very-long-token-that-must-wrap-inside-the-message-bubble`.\n\n![Generated image](https://media.example/generated.png)" }],
      onSendMessage: vi.fn(),
      composerActions: createElement("button", { type: "button", "aria-label": "Add to chat" }, "Add to chat"),
      onOpenVault: vi.fn(),
      activityItems: [{ id: "inspect", title: "Inspecting repository structure", detail: "Reading the selected branch", status: "working" }],
      height: "400px",
      mode: "agent",
      onModeChange: vi.fn(),
    }));

    expect(html).toContain("Agent mode");
    expect(html).toContain("Plan mode");
    expect(html).toContain("Work through approved actions");
    expect(html).toContain("Add to chat");
    expect(html).toContain("Open Project Vault to store a secret");
    expect(html).toContain("https://media.example/generated.png");
    expect(html).toContain("Inspecting repository structure");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("chat-message-bubble");
    expect(html).toContain("chat-message-content");
    expect(html).toContain("chat-composer-row");
  });
});
