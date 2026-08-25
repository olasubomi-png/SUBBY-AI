import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Agents from "./pages/Agents";
import Chat from "./pages/Chat";
import ComingSoon from "./pages/ComingSoon";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Projects from "./pages/Projects";
import Workspace from "./pages/Workspace";

function Router() {
  return <DashboardLayout><Switch>
    <Route path="/" component={Home} />
    <Route path="/projects" component={Projects} />
    <Route path="/chat" component={Chat} />
    <Route path="/agents" component={Agents} />
    <Route path="/workspace" component={Workspace} />
    <Route path="/terminal">{() => <ComingSoon area="terminal" />}</Route>
    <Route path="/github">{() => <ComingSoon area="github" />}</Route>
    <Route path="/deployments">{() => <ComingSoon area="deployments" />}</Route>
    <Route path="/media">{() => <ComingSoon area="media" />}</Route>
    <Route path="/settings">{() => <ComingSoon area="settings" />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></DashboardLayout>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors theme="dark" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
