import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CarouselStudio } from "@/components/CarouselStudio";

export const Route = createFileRoute("/_authenticated/studio/carousel")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [
      { name: "description", content: "Carousel Studio for your IG-Cloner content workspace." },
      { property: "og:title", content: "Carousel Studio — IG-Cloner" },
      { property: "og:description", content: "Carousel Studio for your IG-Cloner content workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },{ title: "Carousel Studio — IG-Cloner" }, { name: "robots", content: "noindex" }] }),
  component: CarouselStudio,
});