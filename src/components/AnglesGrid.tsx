import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Check, Film, LayoutGrid, ImageIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAngles, setDefaultNiche, type Angle } from "@/lib/angles.functions";
import { createProject } from "@/lib/projects.functions";

const NICHES = [
  "Fitness", "Finance", "Beauty", "Business", "Food", "Travel",
  "Motivation", "Education", "Real Estate", "Lifestyle",
];

type Props = {
  analysisId: string;
  initialNiche?: string | null;
};

export function AnglesGrid({ analysisId, initialNiche }: Props) {
  const navigate = useNavigate();
  const genFn = useServerFn(generateAngles);
  const nicheFn = useServerFn(setDefaultNiche);
  const createFn = useServerFn(createProject);

  const [niche, setNiche] = useState<string | null>(initialNiche ?? null);
  const [customNiche, setCustomNiche] = useState("");
  const [angles, setAngles] = useState<Angle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [openingFormat, setOpeningFormat] = useState<string | null>(null);

  const anglesRef = useRef<HTMLDivElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (angles && anglesRef.current) {
      anglesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [angles]);

  useEffect(() => {
    if (selectedIdx !== null && formatRef.current) {
      formatRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedIdx]);

  const fetchAngles = async (n: string) => {
    setLoading(true);
    setAngles(null);
    setSelectedIdx(null);
    try {
      const res: any = await genFn({ data: { analysisId, niche: n } });
      setAngles(res.angles);
      nicheFn({ data: { niche: n } }).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate angles");
    } finally {
      setLoading(false);
    }
  };

  const pickNiche = (n: string) => {
    setNiche(n);
    fetchAngles(n);
  };

  const openStudio = async (format: "reel" | "carousel" | "image") => {
    if (selectedIdx === null || !angles) return;
    const angle = angles[selectedIdx];
    setOpeningFormat(format);
    const target =
      format === "reel" ? "/studio/reel" : format === "carousel" ? "/studio/carousel" : "/studio/image";
    try {
      const res: any = await createFn({
        data: {
          analysisId,
          format,
          title: `${angle.angleName} — ${angle.hookLine.slice(0, 60)}`,
          userPreferences: {
            niche: niche ?? undefined,
            angle: angle.hookLine,
            angleConcept: angle.concept,
            angleType: angle.angleType,
            hookType: angle.hookType,
          },
        },
      });
      const projectId = res.project.id;
      navigate({ to: target as any, search: { projectId } as any });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't open studio");
      setOpeningFormat(null);
    }
  };

  // Step 1: niche picker
  if (!niche) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-primary" />
          <h3 className="text-base font-semibold">Pick your niche to get 5 tailored viral angles</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          The angles are personalized to your content niche. Takes 2 seconds.
        </p>
        <div className="flex flex-wrap gap-2">
          {NICHES.map((n) => (
            <button
              key={n}
              onClick={() => pickNiche(n)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-accent-primary hover:bg-accent-primary/5"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customNiche}
            onChange={(e) => setCustomNiche(e.target.value)}
            placeholder="Or type your own niche…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
          />
          <Button size="sm" disabled={!customNiche.trim()} onClick={() => pickNiche(customNiche.trim())}>
            Use this
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">5 ways to make this viral in <span className="gradient-text">{niche}</span></h2>
          <p className="text-xs text-muted-foreground">Select an angle, then choose your format.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setNiche(null); setAngles(null); }}>
          Change niche
        </Button>
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {angles && (
        <div ref={anglesRef} className="grid gap-3 sm:grid-cols-2 scroll-mt-4">
          {angles.map((a, i) => {
            const isSelected = selectedIdx === i;
            return (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-transparent bg-card ring-2 ring-accent-primary shadow-md"
                    : "border-border bg-card hover:border-strong"
                }`}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">
                    Angle {a.angleNumber}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {a.angleName}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug">"{a.hookLine}"</p>
                <p className="mt-2 text-xs text-muted-foreground">{a.whyItWillPerform}</p>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 font-medium text-accent-secondary capitalize">
                    Best: {a.recommendedFormat}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Viral</span>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
                        style={{ width: `${a.viralPotential}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold">{a.viralPotential}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedIdx !== null && angles && (
        <div ref={formatRef} className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-4 scroll-mt-4">
          <p className="mb-3 text-sm font-semibold">Now choose your format:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormatCard
              icon={<ImageIcon className="h-5 w-5" />}
              title="Image"
              desc="AI-generated image with caption ready to post"
              recommended={angles[selectedIdx].recommendedFormat === "image"}
              loading={openingFormat === "image"}
              onClick={() => openStudio("image")}
            />
            <FormatCard
              icon={<Film className="h-5 w-5" />}
              title="Reel"
              desc="AI script + VEO 3 video prompt + voiceover plan"
              recommended={angles[selectedIdx].recommendedFormat === "reel"}
              loading={openingFormat === "reel"}
              onClick={() => openStudio("reel")}
            />
            <FormatCard
              icon={<LayoutGrid className="h-5 w-5" />}
              title="Carousel"
              desc="Full slide deck with design brief, ready for Canva"
              recommended={angles[selectedIdx].recommendedFormat === "carousel"}
              loading={openingFormat === "carousel"}
              onClick={() => openStudio("carousel")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FormatCard({
  icon, title, desc, recommended, loading, onClick,
}: {
  icon: React.ReactNode; title: string; desc: string;
  recommended: boolean; loading: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`group relative rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-md disabled:opacity-60 ${
        recommended ? "border-accent-primary" : "border-border"
      }`}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 rounded-full bg-accent-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
          Recommended
        </span>
      )}
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-accent-primary">
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening…
          </>
        ) : (
          <>
            Open Studio <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </>
        )}
      </div>
    </button>
  );
}