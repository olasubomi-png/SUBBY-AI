import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { Bot, ChevronRight, Clock3, MessageSquarePlus, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function sessionTime(timestamp: number) {
  const age = Date.now() - timestamp;
  if (age < 60_000) return "now";
  if (age < 3_600_000) return `${Math.max(1, Math.round(age / 60_000))}m`;
  if (age < 86_400_000) return `${Math.max(1, Math.round(age / 3_600_000))}h`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Chat() {
  const utils = trpc.useUtils();
  const { data: workspace } = trpc.workspace.overview.useQuery();
  const sessions = trpc.workspace.listChatSessions.useQuery();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [newChatProjectId, setNewChatProjectId] = useState<number | null>(null);
  const activeSession = sessions.data?.find((session) => session.id === activeSessionId) ?? null;
  const history = trpc.workspace.chatHistory.useQuery({ sessionId: activeSessionId ?? undefined }, { enabled: Boolean(activeSessionId) });
  const [messages, setMessages] = useState<Message[]>([]);
  const newSession = trpc.workspace.createChatSession.useMutation({
    onSuccess: async (session) => { await utils.workspace.listChatSessions.invalidate(); setActiveSessionId(session.id); setMessages([]); },
    onError: (error) => toast.error(error.message),
  });
  const askSubby = trpc.workspace.askSubby.useMutation({
    onSuccess: async (response) => { setMessages((current) => [...current, { role: "assistant", content: response.content }]); setActiveSessionId(response.sessionId); await utils.workspace.chatHistory.invalidate({ sessionId: response.sessionId }); await utils.workspace.listChatSessions.invalidate(); await utils.workspace.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => { if (!activeSessionId && sessions.data?.[0]) setActiveSessionId(sessions.data[0].id); }, [activeSessionId, sessions.data]);
  useEffect(() => { setMessages((history.data ?? []).map((message) => ({ role: message.role, content: message.content }))); }, [history.data]);

  const startNewChat = () => newSession.mutate({ projectId: newChatProjectId });
  const send = async (content: string) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await newSession.mutateAsync({ projectId: newChatProjectId });
      sessionId = session.id;
    }
    setMessages((current) => [...current, { role: "user", content }]);
    askSubby.mutate({ sessionId, projectId: activeSession?.projectId ?? newChatProjectId, content });
  };

  return <section className="ai-chat-page">
    <aside className="conversation-rail" aria-label="Conversations">
      <div className="conversation-rail-head"><div className="conversation-brand"><span><Bot className="size-4" /></span><div><p className="eyebrow">SUBBY AI</p><strong>Conversations</strong></div></div><button onClick={startNewChat} disabled={newSession.isPending} className="new-chat-button"><MessageSquarePlus className="size-4" /> {newSession.isPending ? "Creating…" : "New chat"}</button></div>
      <div className="conversation-context"><label>New chat context<select value={newChatProjectId ?? "global"} onChange={(event) => setNewChatProjectId(event.target.value === "global" ? null : Number(event.target.value))}><option value="global">General workspace</option>{(workspace?.projects ?? []).map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label></div>
      <div className="conversation-list">{sessions.isLoading ? <div className="conversation-loading">Loading conversations…</div> : sessions.data?.length ? sessions.data.map((session) => <button key={session.id} onClick={() => setActiveSessionId(session.id)} className={`conversation-item ${activeSessionId === session.id ? "active" : ""}`}><span className="conversation-item-icon"><Sparkles className="size-3.5" /></span><span><strong>{session.title}</strong><small>{session.projectId ? (workspace?.projects.find((project) => project.id === session.projectId)?.name ?? "Project context") : "General workspace"}</small></span><time>{sessionTime(session.updatedAt)}</time></button>) : <div className="conversation-empty"><MessageSquarePlus className="size-5" /><p>No conversations yet</p><span>Start a new chat and SUBBY will retain it here.</span></div>}</div>
      <div className="conversation-rail-footer"><ShieldCheck className="size-4" /><span>Project Vault values are never included in chat context.</span></div>
    </aside>
    <main className="ai-chat-main">
      <header className="ai-chat-header"><div><p className="eyebrow">AI CO-DEVELOPER</p><h1>{activeSession?.title || "Start a new conversation"}</h1><span>{activeSession?.projectId ? `Project-aware conversation · ${workspace?.projects.find((project) => project.id === activeSession.projectId)?.name ?? "Project"}` : "General coding conversation"}</span></div><div className="ai-chat-status"><span className="subby-pulse" /> SUBBY ready</div></header>
      <div className="ai-chat-stage"><AIChatBox messages={messages} onSendMessage={send} isLoading={askSubby.isPending || history.isLoading || newSession.isPending} height="calc(100svh - 190px)" placeholder="Ask SUBBY to reason through code, plan a feature, review a problem, or prepare the next action…" emptyStateMessage="What would you like to build, fix, or understand?" suggestedPrompts={["Help me plan this feature", "Review my approach before I code", "Explain this error and give me a fix"]} /></div>
      <footer className="ai-chat-footer"><Clock3 className="size-3.5" /><span>Conversation history is saved per session. Start a new chat any time to reset the context.</span><ChevronRight className="size-3.5" /></footer>
    </main>
  </section>;
}
