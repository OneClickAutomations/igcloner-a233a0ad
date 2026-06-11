import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IGCloner — Steal The Strategy. Not The Content." },
      { name: "description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:title", content: "IGCloner — Steal The Strategy. Not The Content." },
      { property: "og:description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
    ],
  }),
  component: LandingPage,
});
