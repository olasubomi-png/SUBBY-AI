import { trpc } from "@/lib/trpc";
import { AlertCircle, Check, ChevronDown, FileCode2, FilePlus2, FolderOpen, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type NewFile = { path: string; language: string; content: string };
const blankFile: NewFile = { path: "", language: "typescript", content: "" };
const languageOptions = ["typescript", "tsx", "javascript", "jsx", "json", "markdown", "css", "html", "python", "plaintext"];

function fileGlyph(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "json") return "{}";
  if (extension === "md") return "M↓";
  if (["css", "html"].includes(extension ?? "")) return "<>";
  return "ƒ";
}

export default function Workspace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: overview, isLoading: projectsLoading } = trpc.workspace.overview.useQuery();
  const projects = overview?.projects ?? [];
  const [projectId, setProjectId] = useState<number | null>(null);
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const fileQuery = trpc.workspace.listFiles.useQuery({ projectId: activeProjectId ?? 1 }, { enabled: Boolean(activeProjectId) });
  const files = fileQuery.data ?? [];
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const selectedFile = useMemo(() => files.find((file) => file.id === selectedFileId), [files, selectedFileId]);
  const [draftPath, setDraftPath] = useState("");
  const [draftLanguage, setDraftLanguage] = useState("plaintext");
  const [draftContent, setDraftContent] = useState("");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFile, setNewFile] = useState<NewFile>(blankFile);

  useEffect(() => {
    if (!files.length) { setSelectedFileId(null); setDraftPath(""); setDraftContent(""); return; }
    const next = selectedFile ?? files[0];
    if (next.id !== selectedFileId) setSelectedFileId(next.id);
    if (!selectedFile || next.id !== selectedFileId) {
      setDraftPath(next.path);
      setDraftLanguage(next.language);
      setDraftContent(next.content);
    }
  }, [files, selectedFile, selectedFileId]);

  const createFile = trpc.workspace.createFile.useMutation({
    onSuccess: async ({ id }) => {
      await utils.workspace.listFiles.invalidate({ projectId: activeProjectId ?? 1 });
      await utils.workspace.overview.invalidate();
      setSelectedFileId(id); setNewFile(blankFile); setNewFileOpen(false); toast.success("Project file created.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateFile = trpc.workspace.updateFile.useMutation({
    onSuccess: async () => { await utils.workspace.listFiles.invalidate({ projectId: activeProjectId ?? 1 }); await utils.workspace.overview.invalidate(); toast.success("Changes saved."); },
    onError: (error) => toast.error(error.message),
  });
  const deleteFile = trpc.workspace.deleteFile.useMutation({
    onSuccess: async () => { await utils.workspace.listFiles.invalidate({ projectId: activeProjectId ?? 1 }); await utils.workspace.overview.invalidate(); setSelectedFileId(null); toast.success("Project file deleted."); },
    onError: (error) => toast.error(error.message),
  });
  const dirty = Boolean(selectedFile && (selectedFile.content !== draftContent || selectedFile.path !== draftPath || selectedFile.language !== draftLanguage));

  const save = () => {
    if (!selectedFile || !dirty) return;
    updateFile.mutate({ id: selectedFile.id, path: draftPath, language: draftLanguage, content: draftContent });
  };
  const remove = () => {
    if (!selectedFile) return;
    if (window.confirm(`Delete ${selectedFile.path}? This cannot be undone.`)) deleteFile.mutate({ id: selectedFile.id, confirmed: true });
  };

  if (!projectsLoading && !projects.length) {
    return <section className="workspace-no-project"><div className="workspace-empty-orb"><FolderOpen className="size-8" /></div><p className="eyebrow">PROJECT FILES</p><h1>Create a project before adding files.</h1><p>File records are safely scoped to a project so their context stays clear across your SUBBY workspace.</p><button className="subby-primary-button" onClick={() => setLocation("/projects")}>Open project hub <ChevronDown className="size-4 -rotate-90" /></button></section>;
  }

  return <section className="workspace-page"><div className="workspace-heading"><div><p className="eyebrow">PROJECT FILES</p><h1>Keep implementation context close.</h1><p>Draft and maintain lightweight project files in a controlled workspace. Changes are persisted to your project record.</p></div><button className="subby-primary-button" onClick={() => setNewFileOpen(true)} disabled={!activeProjectId}><FilePlus2 className="size-4" /> New file</button></div>
    <div className="workspace-project-bar"><FolderOpen className="size-4" /><label>Active project<select value={activeProjectId ?? ""} onChange={(event) => { setProjectId(Number(event.target.value)); setSelectedFileId(null); }}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><span>{files.length} {files.length === 1 ? "file" : "files"}</span></div>
    <div className="workspace-layout"><aside className="file-rail"><div className="file-rail-head"><span>FILES</span><button onClick={() => setNewFileOpen(true)} aria-label="Create file"><FilePlus2 className="size-4" /></button></div>{fileQuery.isLoading ? <p className="file-rail-loading">Loading files…</p> : files.length ? <div className="file-list">{files.map((file) => <button key={file.id} className={`file-list-item ${file.id === selectedFileId ? "selected" : ""}`} onClick={() => setSelectedFileId(file.id)}><span>{fileGlyph(file.path)}</span><strong>{file.path}</strong>{file.id === selectedFileId && dirty && <i />}</button>)}</div> : <div className="file-rail-empty"><FileCode2 className="size-5" /><span>No files yet</span><button onClick={() => setNewFileOpen(true)}>Create the first file</button></div>}</aside>
      <main className="workspace-editor">{selectedFile ? <><header className="editor-toolbar"><div className="editor-path"><input value={draftPath} onChange={(event) => setDraftPath(event.target.value)} aria-label="File path" /><span>{dirty ? "Unsaved changes" : "All changes saved"}</span></div><div className="editor-actions"><select value={draftLanguage} onChange={(event) => setDraftLanguage(event.target.value)} aria-label="File language">{languageOptions.map((language) => <option value={language} key={language}>{language}</option>)}</select><button className="editor-delete" onClick={remove} disabled={deleteFile.isPending} aria-label="Delete current file"><Trash2 className="size-4" /></button><button className="editor-save" onClick={save} disabled={!dirty || updateFile.isPending}><Save className="size-4" /> {updateFile.isPending ? "Saving" : "Save"}</button></div></header><div className="editor-area"><div className="line-numbers" aria-hidden="true">{draftContent.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); } }} spellCheck={false} aria-label={`Content of ${draftPath}`} placeholder="Start writing…" /></div><footer className="editor-footer"><span>{draftContent.length.toLocaleString()} characters</span><span><Check className="size-3.5" /> Persisted project record</span></footer></> : <div className="editor-empty"><FileCode2 className="size-8" /><h2>Select a file to begin</h2><p>Choose a file from the left or create a new one for this project.</p></div>}</main></div>
    {newFileOpen && <div className="subby-modal-backdrop" role="presentation"><section className="subby-modal" role="dialog" aria-modal="true" aria-labelledby="new-file-title"><button className="modal-close" onClick={() => setNewFileOpen(false)} aria-label="Close new file dialog"><X className="size-4" /></button><p className="eyebrow">PROJECT FILE</p><h2 id="new-file-title">Add a controlled file record.</h2><p className="modal-copy">Use a relative path. Paths that move above the project root are blocked.</p><form className="subby-form" onSubmit={(event) => { event.preventDefault(); if (activeProjectId) createFile.mutate({ projectId: activeProjectId, ...newFile }); }}><label>Relative path<input autoFocus required maxLength={240} value={newFile.path} onChange={(event) => setNewFile((current) => ({ ...current, path: event.target.value }))} placeholder="src/components/Header.tsx" /></label><label>Language<select value={newFile.language} onChange={(event) => setNewFile((current) => ({ ...current, language: event.target.value }))}>{languageOptions.map((language) => <option value={language} key={language}>{language}</option>)}</select></label><label>Initial content <span>optional</span><textarea rows={5} maxLength={50000} value={newFile.content} onChange={(event) => setNewFile((current) => ({ ...current, content: event.target.value }))} placeholder="Start the file with a note, a snippet, or an implementation draft." /></label><button className="subby-primary-button w-full" disabled={createFile.isPending} type="submit">{createFile.isPending ? "Creating file…" : "Create project file"}<FilePlus2 className="size-4" /></button></form></section></div>}
    <div className="workspace-safety-note"><AlertCircle className="size-4" /><span>These project files are stored within SUBBY’s workspace records. Direct repository and terminal connections remain clearly separated until they are connected.</span></div>
  </section>;
}
