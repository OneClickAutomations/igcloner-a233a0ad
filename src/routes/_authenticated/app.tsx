import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CreateProjectWizard } from "@/components/CreateProjectWizard";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: z.object({
    analysisId: z.string().uuid().optional(),
    draftId: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Clone Studio — IG-Cloner" },
      { name: "description", content: "Paste any Instagram URL to break down its Content DNA and generate five original clone variations." },
      { property: "og:title", content: "Clone Studio — IG-Cloner" },
      { property: "og:description", content: "Paste any Instagram URL to break down its Content DNA and generate five original clone variations." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateProjectWizard,
});
