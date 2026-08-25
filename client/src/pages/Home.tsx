import { trpc } from "@/lib/trpc";
import { Activity, ArrowRight, Bot, Boxes, CheckCircle2, CircleDashed, Clock3, MessageSquarePlus, Plus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

const statusStyles = {
  planning: "status-slate",
  building: "status-cyan",
  review: "status-purple",
  paused: "status-amber",
};

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.workspace.overview.useQuery();
  const sessions = trpc.workspace.listChatSessions.useQuery();
  const createChatSession = trpc.workspace.createChatSession.useMutation({ onSuccess: (session) => setLocation(`/chat?session=${session.id}`) });
  const summary = data?.summary ?? { totalProjects: 0, activeProjects: 0, inProgressTasks: 0, completedTasks: 0 };
  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];
  const activity = data?.activity ?? [];
  const startNewChat = () => createChatSession.mutate({ projectId: null });

  return (
    <section className="space-y-7">
      <div className="subby-page-heading reveal-up">
        <div><p className="eyebrow">OVERVIEW</p><h1>Build with a clearer signal.</h1><p>Track the work that matters, direct your agents, and keep every project in one focused workspace.</p></div>
        <button onClick={() => setLocation("/projects")} className="subby-primary-button"><Plus className="size-4" /> New project</button>
      </div>

      <div className="subby-metric-grid">
        <article className="metric-card"><div className="metric-icon cyan"><Boxes className="size-5" /></div><div><p>Projects</p><strong>{summary.totalProjects}</strong><span>{summary.activeProjects} active build{summary.activeProjects === 1 ? "" : "s"}</span></div></article>
        <article className="metric-card"><div className="metric-icon purple"><Bot className="size-5" /></div><div><p>Agent work</p><strong>{summary.inProgressTasks}</strong><span>tasks in progress</span></div></article>
        <article className="metric-card"><div className="metric-icon green"><CheckCircle2 className="size-5" /></div><div><p>Completed</p><strong>{summary.completedTasks}</strong><span>verified task{summary.completedTasks === 1 ? "" : "s"}</span></div></article>
        <article className="metric-card metric-card-spotlight"><div className="metric-icon glow"><Sparkles className="size-5" /></div><div><p>SUBBY co-developer</p><strong>Ready</strong><span>Ask for a plan or implementation</span></div><button onClick={() => setLocation("/chat")} aria-label="Open SUBBY co-developer"><ArrowRight className="size-4" /></button></article>
      </div>

      <section className="subby-panel dashboard-conversations">
        <div className="panel-heading"><div><p className="eyebrow">CHAT HISTORY</p><h2>Conversations</h2></div><button onClick={startNewChat} disabled={createChatSession.isPending} className="subby-primary-button"><MessageSquarePlus className="size-4" /> {createChatSession.isPending ? "Creating…" : "New chat"}</button></div>
        {sessions.isLoading ? <div className="subby-empty">Loading conversations…</div> : sessions.data?.length ? <div className="dashboard-conversation-list">{sessions.data.slice(0, 8).map((session) => <button key={session.id} onClick={() => setLocation(`/chat?session=${session.id}`)} className="dashboard-conversation-row"><span className="dashboard-conversation-icon"><Sparkles className="size-3.5" /></span><span className="min-w-0 flex-1 text-left"><strong>{session.title}</strong><small>{session.projectId ? (projects.find((project) => project.id === session.projectId)?.name ?? "Project context") : "General workspace"}</small></span><time><Clock3 className="mr-1 inline size-3" />{relativeTime(session.updatedAt)}</time><ArrowRight className="size-4 text-slate-600" /></button>)}</div> : <EmptyPanel title="No conversations yet" detail="Start a chat with SUBBY and your sessions will be retained here." action="Open Chat" onClick={() => setLocation("/chat")} />}
      </section>

      <div className="subby-dashboard-grid">
        <section className="subby-panel dashboard-projects">
          <div className="panel-heading"><div><p className="eyebrow">PROJECTS</p><h2>Active projects</h2></div><button onClick={() => setLocation("/projects")} className="subby-text-button">View all <ArrowRight className="size-3.5" /></button></div>
          {isLoading ? <div className="subby-empty">Loading your workspace…</div> : projects.length ? <div className="divide-y divide-white/[0.06]">{projects.slice(0, 5).map((project) => <button key={project.id} onClick={() => setLocation("/projects")} className="project-row"><span className="project-orb">{project.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 text-left"><strong>{project.name}</strong><small>{project.description || "No project brief has been added yet."}</small></span><span className={`status-pill ${statusStyles[project.status]}`}>{project.status}</span><ChevronIcon /></button>)}</div> : <EmptyPanel title="No projects yet" detail="Start a project and SUBBY will keep its context, tasks, and activity together." action="Create project" onClick={() => setLocation("/projects")} />}
        </section>

        <section className="subby-panel dashboard-agents">
          <div className="panel-heading"><div><p className="eyebrow">AGENT QUEUE</p><h2>Work in motion</h2></div><button onClick={() => setLocation("/agents")} className="subby-text-button">Task board <ArrowRight className="size-3.5" /></button></div>
          {isLoading ? <div className="subby-empty">Loading task activity…</div> : tasks.length ? <div className="task-preview-list">{tasks.slice(0, 4).map((task) => <div key={task.id} className="task-preview"><span className={`task-state ${task.status}`}><CircleDashed className="size-3.5" /></span><div><strong>{task.title}</strong><small>{task.status.replace("_", " ")}{task.detail ? ` · ${task.detail}` : ""}</small></div></div>)}</div> : <EmptyPanel title="The agent queue is clear" detail="Create a coding task when you are ready to delegate a focused piece of work." action="Open agent tasks" onClick={() => setLocation("/agents")} />}
        </section>

        <section className="subby-panel dashboard-activity">
          <div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent work</h2></div><Activity className="size-5 text-slate-500" /></div>
          {isLoading ? <div className="subby-empty">Loading activity…</div> : activity.length ? <div className="activity-list">{activity.map((event) => <div key={event.id} className="activity-row"><span className={`activity-mark ${event.kind}`} /><div><strong>{event.title}</strong><small>{event.detail || "Workspace event"}</small></div><time>{relativeTime(event.createdAt)}</time></div>)}</div> : <EmptyPanel title="No activity recorded" detail="Your project, agent, and co-developer activity will appear here as you work." />}
        </section>
      </div>
    </section>
  );
}

function ChevronIcon() { return <ArrowRight className="size-4 text-slate-600 transition-transform group-hover:translate-x-0.5" />; }

function EmptyPanel({ title, detail, action, onClick }: { title: string; detail: string; action?: string; onClick?: () => void }) {
  return <div className="subby-empty"><p>{title}</p><span>{detail}</span>{action && <button onClick={onClick} className="subby-text-button mt-3">{action} <ArrowRight className="size-3.5" /></button>}</div>;
}
