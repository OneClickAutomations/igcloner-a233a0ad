import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/DashboardPage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard — IG-Cloner" },
      { name: "description", content: "Your saved analyses, generated clones, and content calendar in one place." },
      { property: "og:title", content: "Dashboard — IG-Cloner" },
      { property: "og:description", content: "Your saved analyses, generated clones, and content calendar in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});
