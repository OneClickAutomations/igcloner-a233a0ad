import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/SettingsPage";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IG-Cloner" },
      { name: "description", content: "Manage your IG-Cloner account, plan, and Instagram connections." },
      { property: "og:title", content: "Settings — IG-Cloner" },
      { property: "og:description", content: "Manage your IG-Cloner account, plan, and Instagram connections." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});
