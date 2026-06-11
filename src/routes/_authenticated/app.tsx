import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "@/components/AppPage";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppPage,
});
