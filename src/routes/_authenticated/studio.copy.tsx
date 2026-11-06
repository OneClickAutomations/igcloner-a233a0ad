import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CopyStudio } from "@/components/CopyStudio";

export const Route = createFileRoute("/_authenticated/studio/copy")({
  validateSearch: z.object({ projectId: z.string().uuid() }),
  head: () => ({
    meta: [
      { title: "Copy Studio — IG-Cloner" },
      { name: "description", content: "Review an exact copy or replace the words on the original visuals before publishing." },
      { property: "og:title", content: "Copy Studio — IG-Cloner" },
      { property: "og:description", content: "Exact copies and same-look rewrites of analyzed posts, ready to publish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CopyStudio,
});
