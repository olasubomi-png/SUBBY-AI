import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: ({ children }: { children: string }) => children }));

import { AIChatBox } from "../client/src/components/AIChatBox";

describe("AIChatBox composer actions", () => {
  it("renders a functional action slot beside the message composer without allowing message content to overflow", () => {
    const html = renderToStaticMarkup(createElement(AIChatBox, {
      messages: [{ role: "assistant", content: "A long repository response with `very-long-token-that-must-wrap-inside-the-message-bubble`." }],
      onSendMessage: vi.fn(),
      composerActions: createElement("button", { type: "button", "aria-label": "Add to chat" }, "Add to chat"),
      height: "400px",
    }));

    expect(html).toContain("Add to chat");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("max-w-[calc(100%-2.75rem)]");
  });
});
