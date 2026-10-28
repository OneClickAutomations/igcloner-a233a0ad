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
      { property: "og:title", content: "Intel Research Reports — IGCloner" },
      { property: "og:description", content: "Evidence-based competitor intelligence, 50 content ideas, and premium client reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResearchPage,
});