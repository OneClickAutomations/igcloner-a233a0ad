import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/components/ProjectsPage";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — IGCloner" },
      { name: "description", content: "All your IGCloner content production projects in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsPage,
});