import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ImageStudio } from "@/components/ImageStudio";

export const Route = createFileRoute("/_authenticated/studio/image")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Image Studio — IG-Cloner" },
      {
        name: "description",
        content: "Generate a finished Instagram post image with caption and hashtags from any analyzed post.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImageStudio,
});