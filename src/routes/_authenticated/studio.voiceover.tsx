import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StudioComingSoon } from "@/components/StudioComingSoon";

export const Route = createFileRoute("/_authenticated/studio/voiceover")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Voiceover Studio — IG-Cloner" }, { name: "robots", content: "noindex" }] }),
  component: () => <StudioComingSoon format="voiceover" />,
});