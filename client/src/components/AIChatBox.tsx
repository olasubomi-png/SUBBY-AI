import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { KeyRound, Loader2, Send, User, Sparkles } from "lucide-react";
import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

function extractGeneratedMedia(content: string) {
  const match = content.match(/!\[[^\]]*\]\(((?:https?:\/\/|\/manus-storage\/)[^)\s]+)\)/);
  if (!match) return null;
  return { url: match[1], text: content.replace(match[0], "").trim() };
}

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];

  /** Optional functional controls rendered before the composer textarea. */
  composerActions?: ReactNode;

  /** Opens the parent workspace's secure Project Vault flow. */
  onOpenVault?: () => void;

  /** External tool actions can insert editable text into the composer. */
  draft?: { id: number; content: string } | null;

  /** Visible work ledger for active and completed SUBBY actions. */
  activityItems?: { id: string | number; title: string; detail?: string; status: "working" | "complete" | "failed" }[];

  /** Functional conversation mode switch. */
  mode?: "agent" | "plan";
  onModeChange?: (mode: "agent" | "plan") => void;
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  composerActions,
  onOpenVault,
  draft,
  activityItems = [],
  mode = "agent",
  onModeChange,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  useEffect(() => {
    if (!draft) return;
    setInput(draft.content);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [draft?.id]);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full min-w-0">
            <div className="flex flex-col space-y-4 p-4">
              {activityItems.length > 0 && <details className="chat-activity-feed" open aria-label="SUBBY work activity"><summary><span className="chat-activity-summary-icon"><Sparkles className="size-3.5" /></span><strong>Workspace</strong><small>{activityItems.filter((item) => item.status === "working").length ? "Working now" : `${Math.min(activityItems.length, 8)} recent actions`}</small></summary><div className="chat-activity-list">{activityItems.slice(0, 8).map((item) => <div className={`chat-activity-item chat-activity-${item.status}`} key={item.id}><span>{item.status === "working" ? <Loader2 className="size-3.5 animate-spin" /> : item.status === "failed" ? "!" : "✓"}</span><div><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</div></div>)}</div></details>}
              {displayMessages.map((message, index) => {
                const generatedMedia = message.role === "assistant" ? extractGeneratedMedia(message.content) : null;
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex min-w-0 gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "min-w-0 max-w-[calc(100%-2.75rem)] overflow-hidden break-words rounded-lg px-4 py-2.5 sm:max-w-[80%]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border border-slate-700/50 bg-slate-900/95 text-slate-100"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert prose-p:text-slate-100 prose-li:text-slate-100 prose-strong:text-white max-w-none break-words [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto">
                          {generatedMedia?.text && <Streamdown>{generatedMedia.text}</Streamdown>}
                          {generatedMedia && <a href={generatedMedia.url} target="_blank" rel="noreferrer" className="not-prose mt-3 block"><img src={generatedMedia.url} alt="Generated project media" className="max-h-[420px] w-full rounded-lg border border-cyan-300/20 object-cover" loading="lazy" /></a>}
                          {!generatedMedia && <Streamdown>{message.content}</Streamdown>}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                  <div className="flex items-start gap-3">
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-2 border-t bg-background/50 p-4"
      >
        {onModeChange && <div className="composer-mode-switch" role="group" aria-label="Chat mode"><button type="button" onClick={() => onModeChange("agent")} className={mode === "agent" ? "active" : ""}><span>Agent mode</span><small>Work through approved actions</small></button><button type="button" onClick={() => onModeChange("plan")} className={mode === "plan" ? "active" : ""}><span>Plan mode</span><small>Plan before any action</small></button></div>}
        <div className="flex min-w-0 items-end gap-2">{composerActions}
        {onOpenVault && <button type="button" onClick={onOpenVault} className="composer-vault-button" aria-label="Open Project Vault to store a secret"><KeyRound className="size-4" /></button>}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 max-h-32 resize-none min-h-9"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button></div>
      </form>
    </div>
  );
}
