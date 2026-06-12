import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Construction, ArrowLeft } from "lucide-react";

export function StudioComingSoon({ format }: { format: "reel" | "carousel" | "voiceover" | "image" }) {
  const navigate = useNavigate();
  const label =
    format === "reel" ? "Video Production Studio" :
    format === "carousel" ? "Carousel Studio" :
    format === "image" ? "Image Studio" :
    "Voiceover Studio";
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-accent text-white shadow-ig">
        <Construction className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label}</h1>
      <p className="mt-2 text-muted-foreground">
        Your project is saved. The full studio for this format is shipping next — open Projects to come back to it any time.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/projects" })}>
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Button>
        <Button onClick={() => navigate({ to: "/app" })}>Analyze another post</Button>
      </div>
    </div>
  );
}