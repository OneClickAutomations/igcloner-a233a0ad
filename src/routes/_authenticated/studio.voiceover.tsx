import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VoiceoverStudio } from "@/components/VoiceoverStudio";

export const Route = createFileRoute("/_authenticated/studio/voiceover")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [
      { name: "description", content: "Voiceover Studio for your IG-Cloner content workspace." },
      { property: "og:title", content: "Voiceover Studio — IG-Cloner" },
      { property: "og:description", content: "Voiceover Studio for your IG-Cloner content workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },{ title: "Voiceover Studio — IG-Cloner" }, { name: "robots", content: "noindex" }] }),
  component: VoiceoverStudio,
});