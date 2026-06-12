import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/85 px-3 backdrop-blur lg:px-4">
            <SidebarTrigger
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-ig hover:bg-accent lg:h-9 lg:w-9"
            >
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-semibold gradient-text sm:inline">IGCloner</span>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
