import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, LayoutDashboard, Calendar as CalendarIcon, Settings as SettingsIcon, LogOut, FolderOpen, Send, Search, Coins, Film } from "lucide-react";
import { getCreditBalance } from "@/lib/credits.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CREDIT_BALANCE_KEY } from "@/lib/credits";
import { VIDEO_BALANCE_KEY } from '@/lib/studio-pricing';
import { getVideoCreditBalance } from '@/lib/video-credits.functions';
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
  { title: "Video Inspiration", url: "/studio/inspiration", icon: Film, t1: "teal", t2: "green" },
  { title: "Projects", url: "/projects", icon: FolderOpen, t1: "purple", t2: "pink" },
  { title: "Content Library", url: "/library", icon: FolderOpen, t1: "purple", t2: "pink" },
  { title: "Content Calendar", url: "/calendar", icon: CalendarIcon, t1: "amber", t2: "orange" },
  { title: "Publishing", url: "/publishing", icon: Send, t1: "indigo", t2: "violet" },
  { title: "Settings & Integrations", url: "/settings", icon: SettingsIcon, t1: "slate", t2: "slate" },
] as const;

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");
  // Close the mobile sheet when a destination is picked; the Sheet's own
  // slide-out transition plays while the page navigates underneath.
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const balanceFn = useServerFn(getCreditBalance);
  // Shared "credit-balance" query: any action that moves credits
  // invalidates it, so the chip updates without navigation.
  const { data: balanceData } = useQuery({
    queryKey: CREDIT_BALANCE_KEY,
    queryFn: () => balanceFn(),
    staleTime: 15_000,
  });
  const credits = balanceData?.balance ?? null;
  const videoBalanceFn=useServerFn(getVideoCreditBalance);
  const {data:videoBalance}=useQuery({queryKey:VIDEO_BALANCE_KEY,queryFn:()=>videoBalanceFn(),staleTime:15000});

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
                      onClick={closeMobile}
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
        <Link
          to="/settings"
          search={{ section: "usage" } as any}
          onClick={closeMobile}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm transition-colors hover:bg-accent-primary/8"
          title="Credit balance — see Settings → Usage for history"
        >
          <Coins className="h-4 w-4 shrink-0 text-accent-primary" />
          {!collapsed && (
            <>
              <span className="font-mono font-bold tabular-nums">{credits ?? "…"}</span>
              <span className="text-muted-foreground">plan credits</span>
            </>
          )}
        </Link>
        <Link to="/studio/inspiration" onClick={closeMobile} title="Separate video-credit balance" className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"><Film className="size-4 shrink-0 text-primary"/>{!collapsed&&<><span className="font-mono font-bold tabular-nums">{videoBalance?.balance??'…'}</span><span className="text-muted-foreground">video credits</span></>}</Link>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-text-secondary hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            closeMobile();
            await queryClient.cancelQueries();
            queryClient.clear();
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}