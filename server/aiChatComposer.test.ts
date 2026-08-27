import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => children }));

import { AIChatBox } from "../client/src/components/AIChatBox";

describe("AIChatBox conversation and composer", () => {
  it("renders document-like assistant content, a restrained user message, and one unified composer with safe overflow boundaries", () => {
    const html = renderToStaticMarkup(createElement(AIChatBox, {
      messages: [
        { role: "user", content: "Please inspect this long repository response." },
        { role: "assistant", content: "A long repository response with `very-long-token-that-must-wrap-inside-the-message-bubble`.\n\n![Generated image](https://media.example/generated.png)" },
      ],
      onSendMessage: vi.fn(),
      composerActions: createElement("button", { type: "button", "aria-label": "Add to chat" }, "Add to chat"),
      onOpenVault: vi.fn(),
      activityItems: [{ id: "inspect", title: "Inspecting repository structure", detail: "Reading the selected branch", status: "working" }],
      height: "400px",
      mode: "agent",
      onModeChange: vi.fn(),
    }));

    expect(html).toContain(">Agent<");
    expect(html).toContain(">Plan<");
    expect(html).toContain("Work through approved actions");
    expect(html).toContain("Add to chat");
    expect(html).toContain("Open Project Vault to store a secret");
    expect(html).toContain("https://media.example/generated.png");
    expect(html).toContain("Inspecting repository structure");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("chat-message-bubble");
    expect(html).toContain("chat-message-content");
    expect(html).toContain("chat-user-message");
    expect(html).toContain("chat-assistant-message");
    expect(html).toContain("chat-composer-row");
    expect(html).toContain("chat-composer-frame");
    expect(html).toContain("chat-composer-input");
    expect(html).toContain("Enter to send");
  });

  it("keeps the send-control footprint stable and clearly communicates the response-preparation state", () => {
    const html = renderToStaticMarkup(createElement(AIChatBox, {
      messages: [{ role: "user", content: "Please review this file." }],
      onSendMessage: vi.fn(),
      isLoading: true,
      height: "400px",
    }));

    expect(html).toContain("chat-send-button");
    expect(html).toContain("SUBBY is preparing a response");
    expect(html).toContain("disabled");
  });
});
