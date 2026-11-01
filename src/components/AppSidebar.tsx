import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Copy, LayoutDashboard, Calendar as CalendarIcon, Settings as SettingsIcon, LogOut, FolderOpen, Send, Search } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, t1: "purple", t2: "pink" },
  { title: "Research", url: "/research", icon: Search, t1: "teal", t2: "green" },
  { title: "Clone Studio", url: "/app", icon: Copy, t1: "pink", t2: "rose" },
  { title: "Projects", url: "/projects", icon: FolderOpen, t1: "blue", t2: "cyan" },
  { title: "Content Calendar", url: "/calendar", icon: CalendarIcon, t1: "amber", t2: "orange" },
  { title: "Publishing", url: "/publishing", icon: Send, t1: "indigo", t2: "violet" },
  { title: "Settings & Integrations", url: "/settings", icon: SettingsIcon, t1: "slate", t2: "slate" },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/app" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg cta-glow [animation:none] shrink-0 shadow-ig">
            <span className="text-sm font-black text-white">IG</span>
          </div>
          {!collapsed && <span className="text-base font-extrabold tracking-tight gradient-text">IG-Cloner</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link
                      to={item.url}
                      className={`flex items-center gap-2.5 rounded-xl transition-colors ${
                        isActive(item.url)
                          ? "nav-active font-semibold"
                          : "text-muted-foreground hover:bg-accent-primary/8"
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-primary-foreground"
                        style={{
                          background: isActive(item.url)
                            ? "color-mix(in oklab, var(--primary-foreground) 22%, transparent)"
                            : `linear-gradient(135deg, var(--tone-${item.t1}), var(--tone-${item.t2}))`,
                        }}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      {!collapsed && <span className="text-[15px]">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-text-secondary hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}