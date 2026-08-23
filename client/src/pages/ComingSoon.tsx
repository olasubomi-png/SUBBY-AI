import { ArrowRight, CloudCog, Github, Image, TerminalSquare, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

const detail: Record<string, { label: string; title: string; description: string; icon: LucideIcon; capabilities: string[] }> = {
  workspace: { label: "WORKSPACE", title: "Project files, in one focused place.", description: "A controlled file workspace is planned for a future SUBBY release. It will make project structure and code context easier to inspect alongside your agent work.", icon: TerminalSquare, capabilities: ["Project file explorer", "Focused code context", "Controlled file operations"] },
  terminal: { label: "TERMINAL", title: "A safer path to command execution.", description: "Terminal execution needs an isolated project environment and clear user approvals. This integration is not connected in the current workspace.", icon: TerminalSquare, capabilities: ["Isolated workspaces", "Command approval flow", "Execution output history"] },
  github: { label: "GITHUB", title: "Repository context, ready to connect.", description: "GitHub authentication and repository actions are not connected in this workspace yet. The project hub remains available for your planning records now.", icon: Github, capabilities: ["Repository connections", "Branch and pull request context", "Commit and diff history"] },
  deployments: { label: "DEPLOYMENTS", title: "Release visibility without the noise.", description: "Deployment providers are not connected in the current workspace. Add project context and agent tasks now, then connect release workflows in a later version.", icon: CloudCog, capabilities: ["Release status", "Environment history", "Deployment approvals"] },
  media: { label: "MEDIA TOOLS", title: "Creative tools are on the roadmap.", description: "Image and video capabilities are unavailable in this workspace for now. They will be deliberately separated from your development context when connected.", icon: Image, capabilities: ["Image generation", "Video generation", "Project asset organization"] },
  settings: { label: "SETTINGS", title: "Workspace controls are coming soon.", description: "Your signed-in identity and persisted workspace are active. Additional preferences and account controls will be added here in a later release.", icon: CloudCog, capabilities: ["Workspace preferences", "Connection controls", "Notifications"] },
};

export default function ComingSoon({ area }: { area: keyof typeof detail }) {
  const [, setLocation] = useLocation();
  const page = detail[area];
  const Icon = page.icon;
  return <section className="coming-soon-page"><div className="coming-soon-orbit orbit-one" /><div className="coming-soon-orbit orbit-two" /><div className="coming-soon-card"><div className="coming-soon-icon"><Icon className="size-8" /></div><p className="eyebrow">{page.label}</p><div className="coming-soon-badge">Coming soon</div><h1>{page.title}</h1><p>{page.description}</p><div className="coming-soon-capabilities">{page.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div><button className="subby-primary-button" onClick={() => setLocation("/")}>Back to overview <ArrowRight className="size-4" /></button></div></section>;
}
