import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CarouselStudio } from "@/components/CarouselStudio";

export const Route = createFileRoute("/_authenticated/studio/carousel")({
  validateSearch: z.object({ projectId: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Carousel Studio — IG-Cloner" }, { name: "robots", content: "noindex" }] }),
  component: CarouselStudio,
});