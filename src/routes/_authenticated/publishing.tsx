import { createFileRoute } from "@tanstack/react-router";
import { PublishingCenter } from "@/components/PublishingCenter";

type PublishingSearch = {
  tab?: string;
  connected?: boolean;
  projectId?: string;
};

export const Route = createFileRoute("/_authenticated/publishing")({
  validateSearch: (search: Record<string, unknown>): PublishingSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    connected: search.connected === true || search.connected === "true",
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Publishing — IG-Cloner" },
      {
        name: "description",
        content:
          "Connect your social accounts and publish AI-generated content everywhere at once.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublishingCenter,
});
