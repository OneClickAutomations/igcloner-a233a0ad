import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";
import homeShare from "@/assets/igcloner-home-share-gradient.jpg.asset.json";

const homeShareUrl = `https://igcloner.com${homeShare.url}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "IG-Cloner — Steal The Strategy. Not The Content." },
      { name: "description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:title", content: "IG-Cloner — Steal The Strategy. Not The Content." },
      { property: "og:description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:url", content: "https://www.igcloner.com/" },
      { name: "twitter:title", content: "IG-Cloner — Steal The Strategy. Not The Content." },
      { name: "twitter:description", content: "Paste any Instagram URL. Discover why it works. Generate 5 original content clones in seconds." },
      { property: "og:image", content: homeShareUrl },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "IGCloner homepage with its hooded character: Steal the Strategy. Not the Content." },
      { name: "twitter:image", content: homeShareUrl },
    ],
    links: [
      { rel: "canonical", href: "https://www.igcloner.com/" },
    ],
  }),
  component: LandingPage,
});
