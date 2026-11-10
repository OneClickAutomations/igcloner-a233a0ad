import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/SettingsPage";
import profileShare from "@/assets/igcloner-profile-share.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: (search.section as string) ?? "profile",
  }),
  head: ({ match }) => ({
    meta: [
      { title: match.search.section === "profile" ? "Your Profile — IGCloner AI Social Content Studio" : "Settings & Integrations — IG-Cloner" },
      { name: "description", content: match.search.section === "profile" ? "Manage your IGCloner profile for AI-powered Instagram and Facebook content analysis. Turn post ideas into original hooks, captions, carousels and reels." : "Manage your IG-Cloner account, API keys, connected platforms, and preferences." },
      { property: "og:title", content: match.search.section === "profile" ? "Your Profile — IGCloner AI Social Content Studio" : "Settings & Integrations — IG-Cloner" },
      { property: "og:description", content: match.search.section === "profile" ? "Manage your IGCloner profile for AI-powered Instagram and Facebook content analysis. Turn post ideas into original hooks, captions, carousels and reels." : "Settings & Integrations for your IG-Cloner content workspace." },
      ...(match.search.section === "profile" ? [
        { property: "og:image", content: `https://igcloner.com${profileShare.url}` },
        { name: "twitter:image", content: `https://igcloner.com${profileShare.url}` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "IGCloner hooded character — AI Social Content Studio for Instagram and Facebook" },
      ] : []),
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});
