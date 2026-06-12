import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Film, LayoutGrid, Mic, Type, Image as ImageIcon, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { createProject, type ProjectFormat } from "@/lib/projects.functions";

type FormatCard = {
  format: ProjectFormat;
  title: string;
  blurb: string;
  Icon: typeof Film;
  badge?: string;
};

const CARDS: FormatCard[] = [
  {
    format: "reel",
    title: "Reel / Short Video",
    blurb: "AI script + optimized prompts for VEO, Kling, or Sora. Copy and paste into your video tool.",
    Icon: Film,
  },
  {
    format: "carousel",
    title: "Carousel",
    blurb: "Slide-by-slide generator with headlines, body, and a full design brief for Canva.",
    Icon: LayoutGrid,
  },
  {
    format: "voiceover",
    title: "Voiceover",
    blurb: "ElevenLabs voice for your reel. Pick a voice, tune delivery, download the MP3.",
    Icon: Mic,
    badge: "Needs ElevenLabs",
  },
  {
    format: "caption",
    title: "Caption Only",
    blurb: "Hooks, captions, hashtags, and CTAs — your existing clone variations.",
    Icon: Type,
  },
  {
    format: "image",
    title: "Image Post",
    blurb: "Single AI-generated image styled to the analyzed post's DNA, with caption.",
    Icon: ImageIcon,
  },
];

export function StudioPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/studio" });
  const analysisId = (search as any)?.analysisId as string | undefined;
  const createFn = useServerFn(createProject);
  const [loading, setLoading] = useState<ProjectFormat | null>(null);

  useEffect(() => {
    if (!analysisId) {
      toast.message("Start from an analysis", {
        description: "Analyze a post first, then pick a format.",
      });
    }
  }, [analysisId]);

  const handlePick = async (format: ProjectFormat) => {
    setLoading(format);
    try {
      const res = await createFn({ data: { analysisId: analysisId ?? null, format } });
      const projectId = (res as any).project?.id as string;
      const routes: Record<ProjectFormat, string> = {
        reel: "/studio/reel",
        carousel: "/studio/carousel",
        voiceover: "/studio/voiceover",
        caption: "/app",
        image: "/app",
      };
      navigate({
        to: routes[format],
        search: format === "caption" || format === "image"
          ? { analysisId }
          : { projectId },
      } as any);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't open the studio");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 lg:py-14">
      <div className="mb-8 flex flex-col items-start gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
          Production Studio
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What are you creating?</h1>
        <p className="text-muted-foreground">
          Your source post and DNA will be imported into the studio automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.Icon;
          const isLoading = loading === c.format;
          return (
            <button
              key={c.format}
              onClick={() => handlePick(c.format)}
              disabled={loading !== null}
              className="group relative flex h-full flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-ig transition-all hover:-translate-y-0.5 hover:border-strong hover:shadow-ig-hover disabled:cursor-wait disabled:opacity-60"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-accent text-white shadow-ig">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex w-full items-center justify-between gap-2">
                <h3 className="text-base font-semibold tracking-tight">{c.title}</h3>
                {c.badge && (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {c.badge}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{c.blurb}</p>
              <div className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium gradient-text">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Opening…
                  </>
                ) : (
                  <>
                    Open Studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}