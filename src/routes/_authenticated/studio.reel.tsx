import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StudioComingSoon } from "@/components/StudioComingSoon";

export const Route = createFileRoute("/_authenticated/studio/reel")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Reel Studio — IGCloner" }, { name: "robots", content: "noindex" }] }),
  component: () => <StudioComingSoon format="reel" />,
});