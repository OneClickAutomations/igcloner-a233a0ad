import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppPage } from "@/components/AppPage";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: z.object({
    analysisId: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Analyze a Post — IG-Cloner" },
      { name: "description", content: "Paste any Instagram URL to break down its Content DNA and generate five original clone variations." },
      { property: "og:title", content: "Analyze a Post — IG-Cloner" },
      { property: "og:description", content: "Paste any Instagram URL to break down its Content DNA and generate five original clone variations." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppPage,
});
