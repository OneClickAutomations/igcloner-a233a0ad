import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CreateProjectWizard } from "@/components/CreateProjectWizard";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: z.object({
    analysisId: z.string().uuid().optional(),
    draftId: z.string().uuid().optional(),
    format: z.enum(['image','carousel','reel','film']).optional(),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Create a project — IG-Cloner" },
      { name: "description", content: "Create images, carousels and films in saved steps, from an analyzed social post to download." },
      { property: "og:title", content: "Create a project — IG-Cloner" },
      { property: "og:description", content: "Choose a source, review it, write your words and make content with explicit credit quotes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateProjectWizard,
});
