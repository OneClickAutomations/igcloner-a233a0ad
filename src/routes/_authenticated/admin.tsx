import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (profile?.role !== "admin") throw redirect({ to: "/app" });
  },
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — IGCloner" },
      { name: "description", content: "Internal admin console for managing IGCloner users and content." },
      { property: "og:title", content: "Admin — IGCloner" },
      { property: "og:description", content: "Internal admin console for managing IGCloner users and content." },
      { name: "robots", content: "noindex" },
    ],
  }),
});
