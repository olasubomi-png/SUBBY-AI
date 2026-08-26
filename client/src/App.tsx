import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Agents = lazy(() => import("./pages/Agents"));
const Chat = lazy(() => import("./pages/Chat"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const CompanionTools = lazy(async () => {
  const module = await import("./pages/CompanionTools");
  return { default: ({ type }: { type: "terminal" | "deployments" | "media" }) => type === "terminal" ? <module.TerminalTool /> : type === "deployments" ? <module.DeploymentsTool /> : <module.MediaTool /> };
});
const GitHubWorkspace = lazy(() => import("./pages/GitHubWorkspace"));
const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectVault = lazy(() => import("./pages/ProjectVault"));
const Workspace = lazy(() => import("./pages/Workspace"));

function Router() {
  return <DashboardLayout><Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#060710] text-slate-200"><div className="text-sm text-slate-400">Loading workspace…</div></div>}><Switch>
    <Route path="/" component={Chat} />
    <Route path="/overview" component={Home} />
    <Route path="/projects" component={Projects} />
    <Route path="/chat" component={Chat} />
    <Route path="/agents" component={Agents} />
    <Route path="/workspace" component={Workspace} />
    <Route path="/terminal" component={() => <CompanionTools type="terminal" />} />
    <Route path="/github" component={GitHubWorkspace} />
    <Route path="/deployments" component={() => <CompanionTools type="deployments" />} />
    <Route path="/media" component={() => <CompanionTools type="media" />} />
    <Route path="/settings" component={ProjectVault} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></Suspense></DashboardLayout>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors theme="dark" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
