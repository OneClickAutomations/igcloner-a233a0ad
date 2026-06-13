import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StudioPage } from "@/components/StudioPage";

export const Route = createFileRoute("/_authenticated/studio/")({
  validateSearch: z.object({
    analysisId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    mode: z.enum(["exact", "inspired"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Production Studio — IGCloner" },
      { name: "description", content: "Pick a format and turn any analyzed Instagram post into a reel, carousel, voiceover, caption, or image." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioPage,
});