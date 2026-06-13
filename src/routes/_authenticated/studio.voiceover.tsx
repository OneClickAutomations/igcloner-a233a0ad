import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VoiceoverStudio } from "@/components/VoiceoverStudio";

export const Route = createFileRoute("/_authenticated/studio/voiceover")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Voiceover Studio — IG-Cloner" }, { name: "robots", content: "noindex" }] }),
  component: VoiceoverStudio,
});