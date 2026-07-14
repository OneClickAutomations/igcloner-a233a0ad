import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign In or Create Account — IG-Cloner" },
      { name: "description", content: "Sign in to IG-Cloner or create a free account to start analyzing Instagram posts and generating original content clones." },
      { property: "og:title", content: "Sign In or Create Account — IG-Cloner" },
      { property: "og:description", content: "Sign in to IG-Cloner or create a free account to start analyzing Instagram posts and generating original content clones." },
      { property: "og:url", content: "https://www.igcloner.com/auth" },
      { name: "twitter:title", content: "Sign In or Create Account — IG-Cloner" },
      { name: "twitter:description", content: "Sign in to IG-Cloner or create a free account to start analyzing Instagram posts and generating original content clones." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://www.igcloner.com/auth" }],
  }),
  component: AuthPage,
});
