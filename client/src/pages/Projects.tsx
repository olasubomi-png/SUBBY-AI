import { trpc } from "@/lib/trpc";
import { ArrowRight, Boxes, Check, FolderCode, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ProjectStatus = "planning" | "building" | "review" | "paused";

const statusInfo: Record<ProjectStatus, { label: string; className: string; note: string }> = {
  planning: { label: "Planning", className: "status-slate", note: "Shaping the brief and approach" },
  building: { label: "Building", className: "status-cyan", note: "Active development in progress" },
  review: { label: "Review", className: "status-purple", note: "Ready for verification" },
  paused: { label: "Paused", className: "status-amber", note: "Waiting for the next decision" },
};

export default function Projects() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.workspace.overview.useQuery();
  const createProject = trpc.workspace.createProject.useMutation({
    onSuccess: async () => { await utils.workspace.overview.invalidate(); toast.success("Project created in your workspace."); setOpen(false); },
    onError: (error) => toast.error(error.message),
  });
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const projects = data?.projects ?? [];
  const selectedProject = projects.find((project) => project.id === selectedId) ?? projects[0];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    createProject.mutate({ name, description: description || undefined, status });
  };

  return (
    <section className="space-y-7">
      <div className="subby-page-heading"><div><p className="eyebrow">PROJECT HUB</p><h1>Every build has a home.</h1><p>Save the essential project context, keep agent work visible, and move from brief to review without losing the thread.</p></div><button className="subby-primary-button" onClick={() => setOpen(true)}><Plus className="size-4" /> Create project</button></div>
      <div className="project-hub-grid">
        <section className="subby-panel project-list-panel">
          <div className="panel-heading"><div><p className="eyebrow">YOUR RECORDS</p><h2>Projects</h2></div><span className="record-count">{projects.length}</span></div>
          {isLoading ? <div className="subby-empty">Loading your projects…</div> : projects.length ? <div className="project-hub-list">{projects.map((project) => <button className={`project-hub-item ${selectedProject?.id === project.id ? "selected" : ""}`} key={project.id} onClick={() => setSelectedId(project.id)}><span className="project-orb"><FolderCode className="size-4" /></span><span className="min-w-0 flex-1 text-left"><strong>{project.name}</strong><small>{project.description || "No project description"}</small></span><span className={`status-pill ${statusInfo[project.status].className}`}>{statusInfo[project.status].label}</span></button>)}</div> : <div className="subby-empty"><p>Create your first project</p><span>Project records persist your brief, agent tasks, activity, and co-developer conversations.</span><button className="subby-text-button mt-3" onClick={() => setOpen(true)}>Start a project <ArrowRight className="size-3.5" /></button></div>}
        </section>
        <section className="subby-panel project-context-panel">
          {selectedProject ? <><div className="project-context-head"><div className="project-context-icon"><Boxes className="size-5" /></div><div><p className="eyebrow">PROJECT CONTEXT</p><h2>{selectedProject.name}</h2><span className={`status-pill ${statusInfo[selectedProject.status].className}`}>{statusInfo[selectedProject.status].label}</span></div></div><div className="context-section"><p>Brief</p><div>{selectedProject.description || "No project brief yet. Add context through SUBBY co-developer to begin shaping the implementation plan."}</div></div><div className="context-facts"><div><span>Current stage</span><strong>{statusInfo[selectedProject.status].note}</strong></div><div><span>Last updated</span><strong>{new Date(selectedProject.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong></div></div><div className="context-next"><Check className="size-4" /><span>Use the co-developer workspace to ask SUBBY for a plan grounded in this project.</span></div></> : <div className="subby-empty"><p>Project context appears here</p><span>Select or create a project to begin building a persisted development record.</span></div>}
        </section>
      </div>
      {open && <div className="subby-modal-backdrop" role="presentation"><section className="subby-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title"><button className="modal-close" onClick={() => setOpen(false)} aria-label="Close create project dialog"><X className="size-4" /></button><p className="eyebrow">NEW PROJECT</p><h2 id="new-project-title">Frame the next build.</h2><p className="modal-copy">Start with a clear name and brief. SUBBY will hold this context alongside your agent work and chats.</p><form onSubmit={submit} className="subby-form"><label>Project name<input autoFocus required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Developer portal redesign" /></label><label>Brief <span>optional</span><textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="What are you trying to build or improve?" rows={4} /></label><label>Stage<select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}><option value="planning">Planning</option><option value="building">Building</option><option value="review">Review</option><option value="paused">Paused</option></select></label><button type="submit" disabled={createProject.isPending} className="subby-primary-button w-full">{createProject.isPending ? "Creating project…" : "Create project"} <ArrowRight className="size-4" /></button></form></section></div>}
    </section>
  );
}
