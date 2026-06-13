import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/DashboardPage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IG-Cloner" },
      { name: "description", content: "Your saved analyses, generated clones, and content calendar in one place." },
      { property: "og:title", content: "Dashboard — IG-Cloner" },
      { property: "og:description", content: "Your saved analyses, generated clones, and content calendar in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});
