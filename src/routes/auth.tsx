import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Create Account — IGCloner" },
      { name: "description", content: "Sign in to IGCloner or create a free account to start analyzing Instagram posts and generating original content clones." },
      { property: "og:title", content: "Sign In or Create Account — IGCloner" },
      { property: "og:description", content: "Sign in to IGCloner or create a free account to start analyzing Instagram posts and generating original content clones." },
      { property: "og:url", content: "https://igcloner.lovable.app/auth" },
      { name: "twitter:title", content: "Sign In or Create Account — IGCloner" },
      { name: "twitter:description", content: "Sign in to IGCloner or create a free account to start analyzing Instagram posts and generating original content clones." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://igcloner.lovable.app/auth" }],
  }),
  component: AuthPage,
});
