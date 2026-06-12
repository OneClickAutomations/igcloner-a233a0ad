import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/CalendarPage";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Content Calendar — IGCloner" },
      { name: "description", content: "A 30-day Instagram posting plan tailored to your niche, with hooks, captions, and visual ideas for every day." },
      { property: "og:title", content: "Content Calendar — IGCloner" },
      { property: "og:description", content: "A 30-day Instagram posting plan tailored to your niche, with hooks, captions, and visual ideas for every day." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});