import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ProjectsPage } from "@/components/ProjectsPage";

const projectsSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "recent").default("recent"),
  type: fallback(z.string(), "all").default("all"),
  range: fallback(z.string(), "all").default("all"),
  page: fallback(z.number().int(), 1).default(1),
  perPage: fallback(z.number().int(), 10).default(10),
});

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: zodValidator(projectsSearchSchema),
  head: () => ({
    meta: [
      { title: "Projects — IG-Cloner" },
      { name: "description", content: "All your IG-Cloner content production projects in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsPage,
});
