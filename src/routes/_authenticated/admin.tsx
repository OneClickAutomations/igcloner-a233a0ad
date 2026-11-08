import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminPage";
import { VideoCreditGrantPanel } from "@/components/VideoCreditGrantPanel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/app" });
  },
  component: () => (<><VideoCreditGrantPanel /><AdminPage /></>),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin — IG-Cloner" },
      { name: "description", content: "Internal admin console for managing IG-Cloner users and content." },
      { property: "og:title", content: "Admin — IG-Cloner" },
      { property: "og:description", content: "Internal admin console for managing IG-Cloner users and content." },
      { name: "robots", content: "noindex" },
    ],
  }),
});
