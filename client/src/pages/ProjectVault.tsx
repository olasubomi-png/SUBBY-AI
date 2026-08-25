import { trpc } from "@/lib/trpc";
import { AlertTriangle, Check, EyeOff, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ProjectVault() {
  const [, setLocation] = useLocation();
  const { data: overview, isLoading: projectsLoading } = trpc.workspace.overview.useQuery();
  const projects = overview?.projects ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const projectId = selectedId ?? projects[0]?.id ?? null;
  const status = trpc.workspace.projectVaultStatus.useQuery();
  const secrets = trpc.workspace.listProjectSecrets.useQuery({ projectId: projectId ?? 1 }, { enabled: Boolean(projectId) });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const save = trpc.workspace.saveProjectSecret.useMutation({
    onSuccess: async () => { if (projectId) await utils.workspace.listProjectSecrets.invalidate({ projectId }); setName(""); setValue(""); toast.success("Secret encrypted and saved. The value will not be shown again."); },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.workspace.deleteProjectSecret.useMutation({
    onSuccess: () => projectId && utils.workspace.listProjectSecrets.invalidate({ projectId }),
    onError: (error) => toast.error(error.message),
  });

  if (!projectsLoading && !projects.length) return <section className="vault-no-project"><LockKeyhole className="size-8" /><p className="eyebrow">PROJECT VAULT</p><h1>Create a project before adding secrets.</h1><p>Each vault is isolated to one project and is never exposed inside a chat transcript.</p><button className="subby-primary-button" onClick={() => setLocation("/projects")}>Open project hub <Plus className="size-4" /></button></section>;

  const configured = status.data?.configured === true;
  return <section className="vault-page"><div className="vault-heading"><div><p className="eyebrow">PROJECT VAULT</p><h1>Keep sensitive values out of chat.</h1><p>Store project-specific credentials in an encrypted vault. Names and timestamps remain visible for management; saved values are never returned to the browser, chat history, or activity feed.</p></div><div className="vault-heading-icon"><ShieldCheck className="size-5" /></div></div>
    <div className="vault-project-picker"><KeyRound className="size-4" /><label>Project<select value={projectId ?? ""} onChange={(event) => setSelectedId(Number(event.target.value))}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><span>{configured ? "Encryption configured" : "Encryption setup required"}</span></div>
    {!configured ? <section className="vault-setup-card"><div className="vault-setup-icon"><AlertTriangle className="size-5" /></div><div><p className="eyebrow">SECURE SETUP REQUIRED</p><h2>Project Vault encryption is waiting for its server key.</h2><p>Add a Base64-encoded, 32-byte `PROJECT_SECRETS_ENCRYPTION_KEY` to the project’s server secrets. Until then, SUBBY deliberately refuses to accept or store any secret value.</p></div><div className="vault-setup-steps"><span>1</span><p>Generate a key locally with <code>openssl rand -base64 32</code>.</p><span>2</span><p>Add it to the project’s secure server settings.</p><span>3</span><p>Return here to add project secrets without putting them in chat.</p></div></section> : <div className="vault-grid"><section className="subby-panel vault-form-panel"><div className="vault-form-note"><EyeOff className="size-4" /><span>Once saved, the secret value is intentionally never displayed again.</span></div><form className="subby-form" onSubmit={(event) => { event.preventDefault(); if (projectId) save.mutate({ projectId, name, value }); }}><label>Secret name<input required value={name} onChange={(event) => setName(event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9_]{1,127}" placeholder="DATABASE_PASSWORD" /></label><label>Secret value<input required type="password" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="new-password" placeholder="Paste the value only here" /></label><button className="subby-primary-button w-full" disabled={save.isPending}>{save.isPending ? "Encrypting…" : "Encrypt and save secret"}<LockKeyhole className="size-4" /></button></form></section><section className="subby-panel vault-list-panel"><div className="panel-heading"><div><p className="eyebrow">SAVED NAMES</p><h2>Encrypted project entries</h2></div><span className="record-count">{secrets.data?.length ?? 0}</span></div>{secrets.isLoading ? <div className="tool-loading">Loading vault metadata…</div> : secrets.data?.length ? <div className="vault-list">{secrets.data.map((secret) => <article key={secret.id} className="vault-entry"><div><KeyRound className="size-4" /><div><strong>{secret.name}</strong><span>Updated {new Date(secret.updatedAt).toLocaleDateString()}</span></div></div><button onClick={() => { if (window.confirm(`Permanently delete ${secret.name}?`)) remove.mutate({ id: secret.id, confirmed: true }); }} aria-label={`Delete ${secret.name}`}><Trash2 className="size-4" /></button></article>)}</div> : <div className="tool-empty"><p>No encrypted values yet</p><span>Once server encryption is configured, add only the secret names and values this project needs.</span></div>}</section></div>}
    <div className="vault-safety"><Check className="size-4" /><span>SUBBY’s AI chat and repository analysis do not read this vault. Secrets are reserved for future approved project operations that explicitly declare which secret name they use.</span></div>
  </section>;
}
