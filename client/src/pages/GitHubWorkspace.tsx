import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, ChevronRight, CircleDot, FileCode2, GitPullRequest, Github, Link2, Loader2, LogOut, Play, ShieldCheck, Unplug, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function GitHubWorkspace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: overview } = trpc.workspace.overview.useQuery();
  const projects = overview?.projects ?? [];
  const [chosenProjectId, setChosenProjectId] = useState<number | null>(null);
  const projectId = chosenProjectId ?? projects[0]?.id ?? null;
  const status = trpc.github.status.useQuery();
  const repos = trpc.github.listRepositories.useQuery(undefined, { enabled: Boolean(status.data?.connection) });
  const context = trpc.github.repositoryContext.useQuery({ projectId: projectId ?? 1 }, { enabled: Boolean(projectId && status.data?.connection) });
  const workflows = trpc.github.listWorkflows.useQuery({ projectId: projectId ?? 1 }, { enabled: Boolean(projectId && context.data?.repository) });
  const history = trpc.github.operationHistory.useQuery({ projectId: projectId ?? 1 }, { enabled: Boolean(projectId && status.data?.connection) });
  const [repositoryName, setRepositoryName] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [instruction, setInstruction] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const file = trpc.github.readRepositoryFile.useQuery({ projectId: projectId ?? 1, path: selectedPath }, { enabled: Boolean(projectId && selectedPath) });
  const connect = trpc.github.startConnection.useMutation({ onSuccess: ({ url }) => window.location.assign(url), onError: (error) => toast.error(error.message) });
  const bind = trpc.github.bindRepository.useMutation({ onSuccess: async () => { if (projectId) await utils.github.repositoryContext.invalidate({ projectId }); toast.success("Repository linked to this project."); }, onError: (error) => toast.error(error.message) });
  const disconnect = trpc.github.disconnect.useMutation({ onSuccess: async () => { await utils.github.status.invalidate(); toast.success("GitHub connection removed from SUBBY."); }, onError: (error) => toast.error(error.message) });
  const review = trpc.github.inspectFile.useMutation({ onError: (error) => toast.error(error.message) });
  const proposal = trpc.github.proposeFileFix.useMutation({ onError: (error) => toast.error(error.message) });
  const dispatch = trpc.github.dispatchWorkflow.useMutation({ onSuccess: async () => { if (projectId) await utils.github.operationHistory.invalidate({ projectId }); toast.success("GitHub Actions workflow dispatched."); }, onError: (error) => toast.error(error.message) });
  const createPull = trpc.github.createPullRequest.useMutation({ onSuccess: async (result) => { if (projectId) await utils.github.operationHistory.invalidate({ projectId }); toast.success(`Pull request #${result.number} created.`); window.open(result.url, "_blank", "noopener,noreferrer"); }, onError: (error) => toast.error(error.message) });
  const selectedRepo = useMemo(() => repos.data?.find((repo) => repo.fullName === repositoryName), [repos.data, repositoryName]);
  const activeWorkflows = workflows.data?.filter((workflow) => workflow.state === "active") ?? [];
  const manualWorkflows = activeWorkflows.filter((workflow) => workflow.dispatchable);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") { toast.success("GitHub account connected securely."); window.history.replaceState(null, "", "/github"); }
    const error = params.get("github_error");
    if (error) { toast.error(error); window.history.replaceState(null, "", "/github"); }
  }, []);

  if (!projects.length) return <EmptyState icon={Github} title="Create a project before connecting a repository." detail="Repository access is purpose-bound: select one of your repositories and link it to a SUBBY project." onClick={() => setLocation("/projects")} action="Open project hub" />;
  if (!status.data?.configured) return <EmptyState icon={AlertCircle} title="GitHub OAuth is not configured yet." detail="The server needs verified GitHub OAuth credentials before account connection can start." />;

  return <section className="github-workspace-page">
    <div className="github-heading"><div><p className="eyebrow">GITHUB WORKSPACE</p><h1>Connect code context with clear control.</h1><p>SUBBY reads only repositories you explicitly link to a project. Your GitHub token is encrypted on the server and never returned to the browser.</p></div><div className="github-heading-icon"><Github className="size-5" /></div></div>
    <div className="github-project-picker"><span>Project</span><select value={projectId ?? ""} onChange={(event) => { setChosenProjectId(Number(event.target.value)); setSelectedPath(""); setWorkflowId(""); }}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select>{status.data.connection ? <span className="github-connected-label"><CheckCircle2 className="size-3.5" /> @{status.data.connection.githubLogin} connected</span> : <span className="github-disconnected-label"><Unplug className="size-3.5" /> Not connected</span>}</div>

    {!status.data.connection ? <section className="github-connect-card"><div><ShieldCheck className="size-6" /><h2>Connect your GitHub account</h2><p>GitHub will show its approval screen before SUBBY can list repositories. Account tokens remain encrypted on the server.</p><div className="github-scope-list"><span>Repository selection</span><span>Read code context</span><span>Manual workflow dispatch</span><span>Approved pull requests</span></div></div><button className="subby-primary-button" onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Connect GitHub</button></section> : <>
      <div className="github-layout">
        <section className="subby-panel github-repository-panel"><div className="panel-heading"><div><p className="eyebrow">PROJECT REPOSITORY</p><h2>Link a repository</h2></div><button className="github-disconnect" onClick={() => { if (window.confirm("Disconnect GitHub and remove all project repository links?")) disconnect.mutate({ confirmed: true }); }}><LogOut className="size-3.5" /> Disconnect</button></div><div className="github-repository-body"><label>Select repository<select value={repositoryName || context.data?.repository?.fullName || ""} onChange={(event) => setRepositoryName(event.target.value)}><option value="">Choose from your GitHub account</option>{repos.data?.map((repo) => <option value={repo.fullName} key={repo.id}>{repo.fullName}{repo.private ? " · private" : ""}</option>)}</select></label><button className="subby-primary-button w-full" disabled={!selectedRepo || bind.isPending} onClick={() => projectId && repositoryName && bind.mutate({ projectId, fullName: repositoryName })}>{bind.isPending ? "Linking repository…" : "Link repository to project"}<Link2 className="size-4" /></button>{context.data?.repository && <div className="github-linked-repo"><CircleDot className="size-4" /><div><strong>{context.data.repository.fullName}</strong><span>{context.data.repository.private ? "Private repository" : "Public repository"} · {context.data.repository.defaultBranch}</span></div></div>}</div></section>
        <section className="subby-panel github-files-panel"><div className="panel-heading"><div><p className="eyebrow">READ-ONLY INSPECTION</p><h2>Repository files</h2></div><span className="record-count">{context.data?.files.length ?? 0}</span></div>{context.isLoading ? <Loading label="Reading repository tree…" /> : context.data?.repository ? <div className="github-file-browser"><div className="github-file-list">{context.data.files.map((path) => <button className={selectedPath === path ? "selected" : ""} key={path} onClick={() => setSelectedPath(path)}><FileCode2 className="size-3.5" /> {path}</button>)}</div><div className="github-file-preview">{file.isLoading ? <Loading label="Loading file…" /> : file.data ? <><header>{file.data.path}</header><pre>{file.data.content}</pre></> : <div className="github-preview-empty"><FileCode2 className="size-6" /><p>Select a source file to inspect its contents.</p></div>}</div></div> : <EmptyPanel title="No repository linked" detail="Choose a repository and link it to this project to inspect its code." />}</section>
      </div>

      {context.data?.repository && <section className="subby-panel github-action-panel"><div className="panel-heading"><div><p className="eyebrow">SUBBY REPOSITORY ASSIST</p><h2>Review, propose, test, then approve</h2></div><Wand2 className="size-4 text-cyan-200" /></div><div className="github-action-grid">
        <div className="github-ai-action"><p>1. Inspect a selected file</p><button disabled={!selectedPath || review.isPending} onClick={() => projectId && review.mutate({ projectId, path: selectedPath })}><Wand2 className="size-3.5" /> {review.isPending ? "Reviewing…" : "Ask SUBBY to review"}</button>{review.data && <pre>{review.data.review}</pre>}</div>
        <div className="github-ai-action"><p>2. Propose a targeted change</p><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Describe the fix or improvement you want in the selected file." /><button disabled={!selectedPath || instruction.trim().length < 6 || proposal.isPending} onClick={() => projectId && proposal.mutate({ projectId, path: selectedPath, instruction })}><Wand2 className="size-3.5" /> {proposal.isPending ? "Preparing proposal…" : "Create change proposal"}</button>{proposal.data && <div className="github-proposal"><strong>{proposal.data.summary}</strong><span>{proposal.data.commitMessage}</span><button className="github-pr-button" disabled={createPull.isPending} onClick={() => { if (window.confirm("Create a new branch, commit the proposed full-file change, and open a pull request on GitHub?")) projectId && createPull.mutate({ projectId, path: proposal.data.path, content: proposal.data.content, commitMessage: proposal.data.commitMessage, summary: proposal.data.summary, confirmed: true }); }}><GitPullRequest className="size-3.5" /> {createPull.isPending ? "Creating pull request…" : "Approve & create pull request"}</button></div>}</div>
        <div className="github-ai-action"><p>3. Run a manually enabled GitHub Actions workflow</p><select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)}><option value="">{manualWorkflows.length ? "Select a manually runnable workflow" : "No manually runnable workflow"}</option>{manualWorkflows.map((workflow) => <option value={workflow.id} key={workflow.id}>{workflow.name}</option>)}</select><button disabled={!workflowId || dispatch.isPending} onClick={() => { if (window.confirm("Dispatch this existing GitHub Actions workflow on the repository default branch?")) projectId && dispatch.mutate({ projectId, workflowId: Number(workflowId), confirmed: true }); }}><Play className="size-3.5" /> {dispatch.isPending ? "Dispatching…" : "Approve & run workflow"}</button>{activeWorkflows.some((workflow) => !workflow.dispatchable) && <small>Unavailable workflows do not declare `workflow_dispatch`. Add that trigger to their YAML file in GitHub, then refresh this page.</small>}<small>SUBBY dispatches only existing manual workflows and never runs untrusted repository code on this app server.</small></div>
      </div></section>}
      <section className="subby-panel github-history-panel"><div className="panel-heading"><div><p className="eyebrow">OPERATION HISTORY</p><h2>Repository activity</h2></div><span className="record-count">{history.data?.length ?? 0}</span></div>{history.data?.length ? <div className="github-history-list">{history.data.slice(0, 8).map((entry) => <div key={entry.id}><CircleDot className="size-3" /><span><strong>{entry.title}</strong><small>{entry.detail || "GitHub workspace"}</small></span><time>{new Date(entry.createdAt).toLocaleString()}</time></div>)}</div> : <EmptyPanel title="No repository operations yet" detail="Connection, review, test, and pull-request events will be recorded here." />}</section>
      <div className="github-safety-note"><ShieldCheck className="size-4" /><span>Repository content stays read-only until you approve a separate action. Pull requests use a new `subby/` branch, and workflow runs require a workflow-defined `workflow_dispatch` trigger.</span></div>
    </>}
  </section>;
}

function Loading({ label }: { label: string }) { return <div className="tool-loading"><Loader2 className="size-4 animate-spin" /> {label}</div>; }
function EmptyPanel({ title, detail }: { title: string; detail: string }) { return <div className="tool-empty"><p>{title}</p><span>{detail}</span></div>; }
function EmptyState({ icon: Icon, title, detail, action, onClick }: { icon: typeof Github; title: string; detail: string; action?: string; onClick?: () => void }) { return <section className="github-no-project"><Icon className="size-8" /><p className="eyebrow">GITHUB WORKSPACE</p><h1>{title}</h1><p>{detail}</p>{action && <button className="subby-primary-button" onClick={onClick}>{action}<ChevronRight className="size-4" /></button>}</section>; }
