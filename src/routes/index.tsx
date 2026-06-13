import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IG-Cloner — Steal The Strategy. Not The Content." },
      { name: "description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:title", content: "IG-Cloner — Steal The Strategy. Not The Content." },
      { property: "og:description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:url", content: "https://www.igcloner.com/" },
      { name: "twitter:title", content: "IG-Cloner — Steal The Strategy. Not The Content." },
      { name: "twitter:description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/66139199-09e5-4fda-8079-9a5e703152b9" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/66139199-09e5-4fda-8079-9a5e703152b9" },
    ],
    links: [
      { rel: "canonical", href: "https://www.igcloner.com/" },
    ],
  }),
  component: LandingPage,
});
