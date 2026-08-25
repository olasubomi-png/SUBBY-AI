import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { chatRepositoryActions } from "@/lib/chatRepositoryActions";
import { Bot, ChevronRight, Clock3, FileCode2, Github, GitPullRequest, Link2, Loader2, MessageSquarePlus, Play, Plus, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
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
  const [selectedSessionId, setActiveSessionId] = useState<number | null>(null);
  const [newChatProjectId, setNewChatProjectId] = useState<number | null>(null);
  const [repositoryOpen, setRepositoryOpen] = useState(false);
  const [repositoryProjectId, setRepositoryProjectId] = useState<number | null>(null);
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryBranch, setRepositoryBranch] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [changeInstruction, setChangeInstruction] = useState("");
  const activeSessionId = selectedSessionId ?? sessions.data?.[0]?.id ?? null;
  const activeSession = sessions.data?.find((session) => session.id === activeSessionId) ?? null;
  const history = trpc.workspace.chatHistory.useQuery({ sessionId: activeSessionId ?? undefined }, { enabled: Boolean(activeSessionId) });
  const [messages, setMessages] = useState<Message[]>([]);
  const githubStatus = trpc.github.status.useQuery();
  const repositories = trpc.github.listRepositories.useQuery(undefined, { enabled: Boolean(githubStatus.data?.connection) });
  const branches = trpc.github.listRepositoryBranches.useQuery({ fullName: repositoryName }, { enabled: Boolean(githubStatus.data?.connection && repositoryName) });
  const repositoryContext = trpc.github.repositoryContext.useQuery({ projectId: activeSession?.projectId ?? 1, branch: activeSession?.repositoryBranch ?? undefined }, { enabled: Boolean(activeSession?.projectId && activeSession.repositoryId) });
  const workflows = trpc.github.listWorkflows.useQuery({ projectId: activeSession?.projectId ?? 1, branch: activeSession?.repositoryBranch ?? undefined }, { enabled: Boolean(activeSession?.projectId && activeSession.repositoryId) });
  const newSession = trpc.workspace.createChatSession.useMutation({
    onSuccess: async (session) => { await utils.workspace.listChatSessions.invalidate(); setActiveSessionId(session.id); setMessages([]); },
    onError: (error) => toast.error(error.message),
  });
  const askSubby = trpc.workspace.askSubby.useMutation({
    onSuccess: async (response) => { setMessages((current) => [...current, { role: "assistant", content: response.content }]); setActiveSessionId(response.sessionId); await utils.workspace.chatHistory.invalidate({ sessionId: response.sessionId }); await utils.workspace.listChatSessions.invalidate(); await utils.workspace.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const bindRepository = trpc.github.bindRepository.useMutation({ onError: (error) => toast.error(error.message) });
  const attachRepository = trpc.workspace.attachRepositoryToChat.useMutation({ onSuccess: async () => { await utils.workspace.listChatSessions.invalidate(); toast.success("Repository attached to this conversation."); setRepositoryOpen(false); }, onError: (error) => toast.error(error.message) });
  const reviewFile = trpc.github.inspectFile.useMutation({ onError: (error) => toast.error(error.message) });
  const proposeFix = trpc.github.proposeFileFix.useMutation({ onError: (error) => toast.error(error.message) });
  const dispatchWorkflow = trpc.github.dispatchWorkflow.useMutation({ onSuccess: () => toast.success("GitHub Actions workflow dispatched."), onError: (error) => toast.error(error.message) });
  const createPullRequest = trpc.github.createPullRequest.useMutation({ onSuccess: (result) => { toast.success(`Pull request #${result.number} created.`); window.open(result.url, "_blank", "noopener,noreferrer"); }, onError: (error) => toast.error(error.message) });
  const commitApprovedChange = trpc.github.commitApprovedChange.useMutation({ onSuccess: (result) => toast.success(`Approved change committed to ${result.branch}.`), onError: (error) => toast.error(error.message) });

  useEffect(() => { if (!activeSessionId && sessions.data?.[0]) setActiveSessionId(sessions.data[0].id); }, [activeSessionId, sessions.data]);
  useEffect(() => { setMessages((history.data ?? []).map((message) => ({ role: message.role, content: message.content }))); }, [history.data]);
  useEffect(() => { if (repositoryName) setRepositoryBranch(branches.data?.[0] ?? repositories.data?.find((repo) => repo.fullName === repositoryName)?.defaultBranch ?? ""); }, [branches.data, repositories.data, repositoryName]);

  const startNewChat = () => newSession.mutate({ projectId: newChatProjectId });
  const openRepositoryAttachment = async () => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await newSession.mutateAsync({ projectId: newChatProjectId });
      sessionId = session.id;
    }
    setActiveSessionId(sessionId);
    setRepositoryProjectId(activeSession?.projectId ?? newChatProjectId ?? workspace?.projects[0]?.id ?? null);
    setRepositoryOpen(true);
  };
  const attachSelectedRepository = async () => {
    if (!activeSessionId || !repositoryProjectId || !repositoryName) return;
    await bindRepository.mutateAsync({ projectId: repositoryProjectId, fullName: repositoryName });
    await attachRepository.mutateAsync({ sessionId: activeSessionId, projectId: repositoryProjectId, fullName: repositoryName, branch: repositoryBranch });
  };
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
      <header className="ai-chat-header"><div><p className="eyebrow">AI CO-DEVELOPER</p><h1>{activeSession?.title || "Start a new conversation"}</h1><span>{activeSession?.projectId ? `Project-aware conversation · ${workspace?.projects.find((project) => project.id === activeSession.projectId)?.name ?? "Project"}` : "General coding conversation"}</span></div><div className="flex items-center gap-3"><button onClick={openRepositoryAttachment} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1.5 text-[10px] font-extrabold text-cyan-100 hover:bg-cyan-300/20" aria-label="Attach a GitHub repository to this chat"><Plus className="size-4" /> <Github className="size-3.5" /> <span className="hidden sm:inline">Attach repo</span></button><div className="ai-chat-status"><span className="subby-pulse" /> SUBBY ready</div></div></header>
      {activeSession?.repositoryId && (() => { const branch = activeSession.repositoryBranch || repositoryContext.data?.repository?.defaultBranch || "main"; const actions = activeSession.projectId ? chatRepositoryActions({ projectId: activeSession.projectId, branch, path: selectedPath, workflowId: Number(workflowId), instruction: changeInstruction }) : null; return <section className="mx-3 mt-3 grid gap-3 rounded-xl border border-cyan-300/15 bg-slate-950/40 p-3 lg:grid-cols-[1.1fr_.9fr]"><div><div className="mb-2 flex items-center gap-2"><Github className="size-4 text-cyan-200" /><strong className="text-xs text-slate-100">{repositoryContext.data?.repository?.fullName || "Attached repository"}</strong><span className="ml-auto rounded-full border border-cyan-300/25 px-2 py-0.5 font-mono text-[8px] text-cyan-200">{branch}</span></div><div className="flex flex-wrap gap-2"><select value={selectedPath} onChange={(event) => setSelectedPath(event.target.value)} className="min-w-[175px] flex-1 rounded-lg border border-slate-500/25 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-200"><option value="">Select a repository file</option>{repositoryContext.data?.files.map((path) => <option key={path} value={path}>{path}</option>)}</select><button disabled={!selectedPath || reviewFile.isPending} onClick={() => actions && reviewFile.mutate(actions.inspect)} className="inline-flex items-center gap-1 rounded-lg border border-violet-300/25 bg-violet-400/10 px-2 py-1.5 text-[10px] font-bold text-violet-100 disabled:opacity-40"><Wand2 className="size-3.5" /> Inspect</button></div>{reviewFile.data && <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] leading-5 text-slate-300 whitespace-pre-wrap">{reviewFile.data.review}</pre>}</div><div className="grid gap-2"><div className="flex gap-2"><select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-500/25 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-200"><option value="">Run an existing test workflow</option>{workflows.data?.filter((workflow) => workflow.dispatchable && workflow.state === "active").map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select><button disabled={!workflowId || dispatchWorkflow.isPending} onClick={() => { if (window.confirm(`Dispatch this manually enabled GitHub Actions workflow on ${branch}?`)) actions && dispatchWorkflow.mutate(actions.dispatch); }} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2 py-1.5 text-[10px] font-bold text-cyan-100 disabled:opacity-40"><Play className="size-3.5" /> Test</button></div><div className="flex gap-2"><input value={changeInstruction} onChange={(event) => setChangeInstruction(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-500/25 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-200" placeholder="Describe the fix for the selected file" /><button disabled={!selectedPath || changeInstruction.trim().length < 6 || proposeFix.isPending} onClick={() => actions && proposeFix.mutate(actions.propose)} className="inline-flex items-center gap-1 rounded-lg border border-violet-300/25 bg-violet-400/10 px-2 py-1.5 text-[10px] font-bold text-violet-100 disabled:opacity-40"><FileCode2 className="size-3.5" /> Propose</button></div>{proposeFix.data && <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-2"><strong className="block text-[10px] text-amber-100">{proposeFix.data.summary}</strong><span className="mt-1 block text-[9px] text-amber-200/70">{proposeFix.data.commitMessage}</span><div className="mt-2 flex flex-wrap gap-3"><button disabled={createPullRequest.isPending} onClick={() => { if (window.confirm("Create a new subby/ branch, commit this reviewed change, and open a pull request?")) activeSession.projectId && createPullRequest.mutate({ projectId: activeSession.projectId, path: proposeFix.data.path, content: proposeFix.data.content, commitMessage: proposeFix.data.commitMessage, summary: proposeFix.data.summary, confirmed: true }); }} className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-100"><GitPullRequest className="size-3.5" /> Approve PR</button><button disabled={commitApprovedChange.isPending} onClick={() => { if (window.confirm(`Commit this reviewed change directly to ${branch}? This writes to GitHub immediately and cannot be undone from SUBBY.`)) activeSession.projectId && commitApprovedChange.mutate({ projectId: activeSession.projectId, path: proposeFix.data.path, content: proposeFix.data.content, commitMessage: proposeFix.data.commitMessage, branch, confirmed: true }); }} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-100"><Github className="size-3.5" /> Approve commit to {branch}</button></div></div>}<p className="m-0 text-[9px] leading-4 text-slate-500">Tests run through manually enabled GitHub Actions workflows on the selected branch. SUBBY does not execute untrusted repository code on this server.</p></div></section>; })()}
      <div className="ai-chat-stage"><AIChatBox messages={messages} onSendMessage={send} isLoading={askSubby.isPending || history.isLoading || newSession.isPending} height="calc(100svh - 190px)" placeholder="Ask SUBBY to reason through code, plan a feature, review a problem, or prepare the next action…" emptyStateMessage="What would you like to build, fix, or understand?" suggestedPrompts={["Help me plan this feature", "Review my approach before I code", "Explain this error and give me a fix"]} /></div>
      <footer className="ai-chat-footer"><Clock3 className="size-3.5" /><span>Conversation history is saved per session. Start a new chat any time to reset the context.</span><ChevronRight className="size-3.5" /></footer>
    </main>
    {repositoryOpen && <div className="subby-modal-backdrop" role="presentation"><section className="subby-modal max-w-[510px]" role="dialog" aria-modal="true" aria-labelledby="attach-repository-title"><button className="modal-close" onClick={() => setRepositoryOpen(false)} aria-label="Close repository attachment"><X className="size-4" /></button><p className="eyebrow">CHAT REPOSITORY CONTEXT</p><h2 id="attach-repository-title">Attach code to this conversation.</h2><p className="modal-copy">SUBBY will use the selected repository as explicit context for inspection, test requests, diagnosis, and reviewed change proposals. Project Vault values stay excluded.</p>{!githubStatus.data?.connection ? <div className="mt-6 grid gap-2.5 rounded-[10px] border border-cyan-300/20 bg-cyan-300/[0.07] p-4 text-[11px] leading-6 text-slate-300"><Github className="size-5 text-cyan-100" /><p className="m-0">Connect GitHub from the GitHub workspace before attaching a repository to chat.</p><a className="inline-flex w-max items-center gap-1 text-[10px] font-extrabold text-cyan-200 no-underline" href="/github">Open GitHub workspace <ChevronRight className="size-4" /></a></div> : <div className="subby-form"><label>Project<select value={repositoryProjectId ?? ""} onChange={(event) => setRepositoryProjectId(Number(event.target.value))}><option value="" disabled>Select a project</option>{(workspace?.projects ?? []).map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label>Repository<select value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)}><option value="">Choose a connected GitHub repository</option>{repositories.data?.map((repo) => <option value={repo.fullName} key={repo.id}>{repo.fullName}{repo.private ? " · private" : ""}</option>)}</select></label><label>Branch<select value={repositoryBranch} onChange={(event) => setRepositoryBranch(event.target.value)} disabled={!repositoryName || branches.isLoading}><option value="">{branches.isLoading ? "Loading branches…" : "Choose repository branch"}</option>{branches.data?.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label><button onClick={attachSelectedRepository} disabled={!repositoryProjectId || !repositoryName || !repositoryBranch || bindRepository.isPending || attachRepository.isPending} className="subby-primary-button w-full">{bindRepository.isPending || attachRepository.isPending ? <><Loader2 className="size-4 animate-spin" /> Attaching repository…</> : <><Link2 className="size-4" /> Attach to this chat</>}</button></div>}</section></div>}
  </section>;
}
