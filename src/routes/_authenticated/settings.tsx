import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/SettingsPage";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IGCloner" },
      { name: "description", content: "Manage your IGCloner account, plan, and Instagram connections." },
      { property: "og:title", content: "Settings — IGCloner" },
      { property: "og:description", content: "Manage your IGCloner account, plan, and Instagram connections." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});
