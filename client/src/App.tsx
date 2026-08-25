import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Agents from "./pages/Agents";
import Chat from "./pages/Chat";
import ComingSoon from "./pages/ComingSoon";
import { DeploymentsTool, MediaTool, TerminalTool } from "./pages/CompanionTools";
import GitHubWorkspace from "./pages/GitHubWorkspace";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Projects from "./pages/Projects";
import ProjectVault from "./pages/ProjectVault";
import Workspace from "./pages/Workspace";

function Router() {
  return <DashboardLayout><Switch>
    <Route path="/" component={Chat} />
    <Route path="/overview" component={Home} />
    <Route path="/projects" component={Projects} />
    <Route path="/chat" component={Chat} />
    <Route path="/agents" component={Agents} />
    <Route path="/workspace" component={Workspace} />
    <Route path="/terminal" component={TerminalTool} />
    <Route path="/github" component={GitHubWorkspace} />
    <Route path="/deployments" component={DeploymentsTool} />
    <Route path="/media" component={MediaTool} />
    <Route path="/settings" component={ProjectVault} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></DashboardLayout>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors theme="dark" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
