import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ResearchPage } from "@/components/ResearchPage";

export const Route = createFileRoute("/_authenticated/research")({
  validateSearch: z.object({ reportId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Research — IG-Cloner" },
      {
        name: "description",
        content: "Discover what content your audience actually wants. Research by niche, competitor, or topic.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResearchPage,
});