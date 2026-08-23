import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { Bot, Info, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Chat() {
  const utils = trpc.useUtils();
  const { data: workspace } = trpc.workspace.overview.useQuery();
  const [projectId, setProjectId] = useState<number | null>(null);
  const history = trpc.workspace.chatHistory.useQuery({ projectId });
  const [messages, setMessages] = useState<Message[]>([]);
  const askSubby = trpc.workspace.askSubby.useMutation({
    onSuccess: async (response) => { setMessages((current) => [...current, { role: "assistant", content: response.content }]); await utils.workspace.chatHistory.invalidate({ projectId }); await utils.workspace.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => { setMessages((history.data ?? []).map((message) => ({ role: message.role, content: message.content }))); }, [history.data]);

  const send = (content: string) => {
    setMessages((current) => [...current, { role: "user", content }]);
    askSubby.mutate({ projectId, content });
  };

  return <section className="chat-page"><div className="chat-heading"><div><p className="eyebrow">AI CO-DEVELOPER</p><h1>Think in context. Build with intent.</h1><p>Ask coding questions, turn an idea into a technical plan, or get focused implementation and verification guidance.</p></div><div className="chat-project-select"><span>Context</span><select value={projectId ?? "global"} onChange={(event) => setProjectId(event.target.value === "global" ? null : Number(event.target.value))}><option value="global">General workspace</option>{(workspace?.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div></div><div className="chat-workspace"><aside className="chat-side-panel"><div className="chat-side-icon"><Bot className="size-5" /></div><h2>SUBBY</h2><p>Autonomous AI co-developer</p><div className="chat-capability"><Sparkles className="size-4" /><span>Action-oriented responses</span></div><div className="chat-capability"><Info className="size-4" /><span>Clear plans and verification steps</span></div><p className="chat-safety-note">SUBBY can propose actions here. Files, shells, repositories, and deployment integrations are intentionally kept separate in this first workspace release.</p></aside><div className="subby-chat-frame"><AIChatBox messages={messages} onSendMessage={send} isLoading={askSubby.isPending || history.isLoading} height="calc(100svh - 272px)" placeholder="Ask SUBBY to plan, explain, or improve your code…" emptyStateMessage="Start a focused development conversation" suggestedPrompts={["Plan a production-ready authentication flow", "Explain how to structure a feature branch", "Help me debug a TypeScript build error"]} /></div></div></section>;
}
