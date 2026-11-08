import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/SettingsPage";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: (search.section as string) ?? "profile",
  }),
  head: () => ({
    meta: [
      { name: "description", content: "Settings & Integrations for your IG-Cloner content workspace." },
      { property: "og:description", content: "Settings & Integrations for your IG-Cloner content workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings & Integrations — IG-Cloner" },
      {
        name: "description",
        content: "Manage your IG-Cloner account, API keys, connected platforms, and preferences.",
      },
      { property: "og:title", content: "Settings & Integrations — IG-Cloner" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});
