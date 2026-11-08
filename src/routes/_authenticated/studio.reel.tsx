import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ReelStudio } from "@/components/ReelStudio";

export const Route = createFileRoute("/_authenticated/studio/reel")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { name: "description", content: "Video Production Studio for your IG-Cloner content workspace." },
      { property: "og:title", content: "Video Production Studio — IG-Cloner" },
      { property: "og:description", content: "Video Production Studio for your IG-Cloner content workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Video Production Studio — IG-Cloner" },
      {
        name: "description",
        content: "Generate a short-form video script and an optimized Google VEO 3 prompt from any analyzed Instagram post.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReelStudio,
});