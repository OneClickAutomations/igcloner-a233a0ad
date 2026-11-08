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
      { name: "description", content: "Publishing for your IG-Cloner content workspace." },
      { property: "og:title", content: "Publishing — IG-Cloner" },
      { property: "og:description", content: "Publishing for your IG-Cloner content workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
