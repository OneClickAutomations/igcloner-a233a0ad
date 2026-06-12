import { Film, LayoutGrid, Image as ImageIcon, Copy, Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContentFormulaCard({
  dna,
  scraped,
  postType,
  onPick,
}: {
  dna: any;
  scraped: any;
  postType: string;
  onPick: (mode: "exact" | "inspired") => void;
}) {
  const forensics = dna?.forensics ?? {};
  const video = forensics.videoForensics;
  const carousel = forensics.carouselForensics;
  const image = forensics.imageForensics;

  const Icon = postType === "Reel" ? Film : postType === "Carousel" ? LayoutGrid : ImageIcon;

  // Format-specific summary tiles
  const formatTile =
    video
      ? [
          ["Pace", video.pacing?.overall ?? "—"],
          ["Cuts", video.pacing?.averageCutDuration ? `${video.pacing.averageCutDuration}s avg` : "—"],
          ["Style", video.visual?.shootingStyle ?? "—"],
          ["Color", video.visual?.colorGrade ?? "—"],
          ["Audio", video.audio?.musicType ?? "—"],
        ]
      : carousel
      ? [
          ["Slides", carousel.overall?.totalSlides ?? "—"],
          ["Type", carousel.overall?.carouselType ?? "—"],
          ["Hook", carousel.slide1?.hookMechanism ?? "—"],
          ["Design", carousel.designSystem?.fontSystem ?? "—"],
          ["CTA", carousel.finalSlide?.ctaType ?? "—"],
        ]
      : image
      ? [
          ["Subject", image.subject?.primary ?? "—"],
          ["Composition", image.composition?.technique ?? "—"],
          ["Lighting", image.lighting?.source ?? "—"],
          ["Palette", image.color?.paletteType ?? "—"],
          ["Mood", image.color?.mood ?? "—"],
        ]
      : [
          ["Category", dna?.contentCategory ?? "—"],
          ["Hook", dna?.hookBreakdown?.type ?? "—"],
          ["Tone", dna?.captionDNA?.tone ?? "—"],
          ["Visual", dna?.visualStyle?.colorMood ?? "—"],
        ];

  const emo = dna?.emotionalArchitecture ?? {};
  const topEmotions = Object.entries(emo)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3) as [string, number][];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-accent text-white shadow-ig">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Content Formula Extracted
            </div>
            <div className="text-base font-bold tracking-tight">
              {postType}{" "}
              {dna?.performanceScore != null && (
                <span className="text-muted-foreground">· Performance {dna.performanceScore}/100</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onPick("exact")} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Exact Duplicate
          </Button>
          <Button size="sm" variant="outline" onClick={() => onPick("inspired")} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Inspired Version
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Format tile */}
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Icon className="h-3 w-3" /> Format
          </div>
          <dl className="space-y-1 text-xs">
            {formatTile.map(([k, v]) => (
              <div key={k as string} className="flex items-baseline justify-between gap-2">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="truncate text-right font-medium text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Psychology tile */}
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Psychology
          </div>
          <div className="mb-2 text-xs">
            <span className="text-muted-foreground">Hook: </span>
            <span className="font-medium">{dna?.hookBreakdown?.type ?? "—"}</span>
          </div>
          <div className="space-y-1.5">
            {topEmotions.map(([k, v]) => (
              <div key={k} className="text-[11px]">
                <div className="mb-0.5 flex justify-between">
                  <span className="capitalize text-muted-foreground">{k}</span>
                  <span className="font-medium">{Math.round(v)}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full gradient-accent" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics tile */}
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Metrics
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Likes</dt>
              <dd className="font-medium">{fmt(scraped?.likesCount)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Comments</dt>
              <dd className="font-medium">{fmt(scraped?.commentsCount)}</dd>
            </div>
            {(scraped?.videoViewCount || scraped?.videoPlayCount) && (
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Views</dt>
                <dd className="font-medium">
                  {fmt(scraped?.videoViewCount ?? scraped?.videoPlayCount)}
                </dd>
              </div>
            )}
            {dna?.channelIntelligence?.engagementRate != null && (
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Engagement</dt>
                <dd className="font-medium">
                  {Number(dna.channelIntelligence.engagementRate).toFixed(1)}%
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {dna?.contentSummary && (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs italic text-muted-foreground">
          “{dna.contentSummary}”
        </p>
      )}

      {!dna?.forensics && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">Legacy analysis</Badge>
          Re-analyze this post to unlock full forensics.
        </div>
      )}
    </div>
  );
}