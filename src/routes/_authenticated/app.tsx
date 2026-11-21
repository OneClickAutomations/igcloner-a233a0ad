import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CreateProjectWizard } from "@/components/CreateProjectWizard";
import { CreatorStudio } from "@/components/CreatorStudio";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: z.object({
    analysisId: z.string().uuid().optional(),
    draftId: z.string().uuid().optional(),
    format: z.enum(['image','carousel','reel','film']).optional(),
    connected: z.coerce.boolean().optional(),
    advanced: z.coerce.boolean().optional(),
    studio: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Creator Studio — IG-Cloner" },
      { name: "description", content: "Analyze a post, discover better ideas, and create content ready to publish." },
      { property: "og:title", content: "Creator Studio — IG-Cloner" },
      { property: "og:description", content: "Paste a URL, pick a direction and an idea, then generate and publish original content." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppRoute,
});

/** Guided Creator Studio by default; existing drafts, formats and saved analyses keep the Advanced Studio wizard. */
function AppRoute() {
  const s = Route.useSearch();
  const advanced = s.advanced || s.draftId || s.format || (s.analysisId && !s.studio);
  return advanced ? <CreateProjectWizard /> : <CreatorStudio />;
}
