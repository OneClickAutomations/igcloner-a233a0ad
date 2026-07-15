import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/CalendarPage";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Content Calendar — IG-Cloner" },
      { name: "description", content: "Plan, generate, and schedule 30 days of multi-platform content in one place." },
      { property: "og:title", content: "Content Calendar — IG-Cloner" },
      { property: "og:description", content: "Plan, generate, and schedule 30 days of multi-platform content in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});