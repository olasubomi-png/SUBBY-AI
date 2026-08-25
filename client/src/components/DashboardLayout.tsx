import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  ChevronRight,
  CircleUserRound,
  CloudCog,
  Code2,
  Github,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  TerminalSquare,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

const brandLogo = "/manus-storage/subby-logo_b4152d51.png";

const primaryNavigation = [
  { label: "SUBBY Chat", path: "/", icon: Bot },
  { label: "Overview", path: "/overview", icon: LayoutDashboard },
  { label: "Projects", path: "/projects", icon: Boxes },
  { label: "Agent tasks", path: "/agents", icon: Activity },
];

const referenceNavigation = [
  { label: "Chats", path: "/", icon: MessageSquare },
  { label: "Library", path: "/media", icon: BookOpen },
  { label: "Sandbox", path: "/terminal", icon: TerminalSquare },
];

const workspaceNavigation = [
  { label: "Files", path: "/workspace", icon: Code2 },
  { label: "Terminal", path: "/terminal", icon: TerminalSquare },
  { label: "GitHub", path: "/github", icon: Github },
  { label: "Deployments", path: "/deployments", icon: CloudCog },
  { label: "Media tools", path: "/media", icon: Image },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("drawer") === "1");
  const [drawerSearch, setDrawerSearch] = useState("");
  const createDrawerChat = trpc.workspace.createChatSession.useMutation({ onSuccess: (session) => navigate(`/chat?session=${session.id}`) });

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#060710] text-slate-200">
        <div className="flex items-center gap-3 text-sm text-slate-400"><span className="subby-pulse" /> Preparing your workspace</div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="subby-auth-shell">
        <div className="subby-auth-grid" />
        <section className="subby-auth-card" aria-labelledby="sign-in-title">
          <img src={brandLogo} alt="SUBBY" className="h-20 w-20 object-contain" />
          <p className="eyebrow">SUBBY WORKSPACE</p>
          <h1 id="sign-in-title">Your autonomous development workspace is ready.</h1>
          <p>Sign in to create projects, manage agent tasks, and work with your AI co-developer in a personal, persisted workspace.</p>
          <Button onClick={() => startLogin()} className="subby-primary-button w-full">
            Sign in to SUBBY <ChevronRight className="size-4" />
          </Button>
        </section>
      </main>
    );
  }

  const navigate = (path: string) => {
    setLocation(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) => location === path;

  return (
    <div className={`subby-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`subby-sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="SUBBY navigation">
        <div className="subby-brand-row">
          <button onClick={() => navigate("/")} className="subby-brand" aria-label="Go to SUBBY overview">
            <img src={brandLogo} alt="" className="subby-logo" />
            {!collapsed && <span className="subby-wordmark">SUBBY</span>}
          </button>
          <button className="subby-icon-button hide-on-mobile" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        {!collapsed && <div className="mobile-drawer-tools"><button onClick={() => createDrawerChat.mutate({ projectId: null })} disabled={createDrawerChat.isPending} className="mobile-drawer-new-chat"><Plus className="size-4" /> {createDrawerChat.isPending ? "Creating…" : "New chat"}</button><label className="mobile-drawer-search"><Search className="size-4" /><input value={drawerSearch} onChange={(event) => setDrawerSearch(event.target.value)} placeholder="Search workspace…" aria-label="Search workspace" /></label></div>}

        {!collapsed && <div className="mobile-reference-links">{referenceNavigation.filter((item) => !drawerSearch.trim() || item.label.toLowerCase().includes(drawerSearch.toLowerCase())).map((item) => <button key={`quick-${item.path}`} onClick={() => navigate(item.path)} className={`subby-nav-item ${isActive(item.path) ? "active" : ""}`}><item.icon className="size-[17px]" /><span>{item.label}</span></button>)}</div>}
        <nav className="subby-navigation">
          {!collapsed && <p className="nav-label">Build</p>}
          {primaryNavigation.filter((item) => !drawerSearch.trim() || item.label.toLowerCase().includes(drawerSearch.toLowerCase())).map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} className={`subby-nav-item ${isActive(item.path) ? "active" : ""}`} aria-current={isActive(item.path) ? "page" : undefined}>
              <item.icon className="size-[17px]" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
          {!collapsed && <p className="nav-label mt-6">Workspace</p>}
          {workspaceNavigation.filter((item) => !drawerSearch.trim() || item.label.toLowerCase().includes(drawerSearch.toLowerCase())).map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} className={`subby-nav-item ${isActive(item.path) ? "active" : ""}`} aria-current={isActive(item.path) ? "page" : undefined}>
              <item.icon className="size-[17px]" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="subby-sidebar-bottom">
          <button onClick={() => navigate("/projects")} className="subby-new-project-button" title="Create a project">
            <Plus className="size-4" /> {!collapsed && <span>New project</span>}
          </button>
          <button onClick={() => navigate("/settings")} className={`subby-nav-item ${isActive("/settings") ? "active" : ""}`}>
            <Settings className="size-[17px]" /> {!collapsed && <span>Project vault</span>}
          </button>
          <div className="subby-user-row">
            <div className="subby-avatar" aria-hidden="true">{user.name?.slice(0, 1).toUpperCase() || <CircleUserRound className="size-4" />}</div>
            {!collapsed && <div className="min-w-0 flex-1"><p>{user.name || "Developer"}</p><span>{user.email || "Signed-in developer"}</span></div>}
            {!collapsed && <button onClick={logout} className="subby-logout" aria-label="Sign out"><LogOut className="size-4" /></button>}
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="subby-mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="subby-main">
        <header className="subby-topbar">
          <button className="subby-icon-button show-on-mobile" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
          <div className="subby-connection"><span className="subby-pulse" /> Workspace online</div>
          <div className="subby-topbar-spacer" />
          <button onClick={() => navigate("/chat")} className="subby-ask-button"><Bot className="size-4" /> Ask SUBBY</button>
        </header>
        <div className="subby-page-wrap">{children}</div>
      </main>
    </div>
  );
}
