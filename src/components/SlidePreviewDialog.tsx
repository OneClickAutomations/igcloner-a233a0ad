import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CarouselDoc } from "@/lib/carousel.functions";

function extractHexes(palette: string): string[] {
  const matches = palette.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) ?? [];
  return matches.slice(0, 5);
}

export function SlidePreviewDialog({
  doc,
  openIndex,
  onOpenChange,
  onIndexChange,
}: {
  doc: CarouselDoc | null;
  openIndex: number | null;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (idx: number) => void;
}) {
  const open = openIndex !== null && doc !== null;
  const slide = useMemo(
    () => (doc && openIndex !== null ? doc.slides.find((s) => s.index === openIndex) ?? null : null),
    [doc, openIndex],
  );

  const hexes = useMemo(() => (doc ? extractHexes(doc.designBrief.palette) : []), [doc]);
  const bg = hexes[0] ?? "#0F172A";
  const accent = hexes[1] ?? "#F59E0B";
  const fg = hexes[2] ?? "#FFFFFF";

  useEffect(() => {
    if (!open || !doc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        const next = doc.slides.find((s) => s.index === (openIndex ?? 0) + 1);
        if (next) onIndexChange(next.index);
      } else if (e.key === "ArrowLeft") {
        const prev = doc.slides.find((s) => s.index === (openIndex ?? 0) - 1);
        if (prev) onIndexChange(prev.index);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, doc, openIndex, onIndexChange]);

  if (!doc || !slide) return null;
  const total = doc.slides.length;
  const hasPrev = slide.index > 1;
  const hasNext = slide.index < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,720px)] gap-0 border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">
          Slide {slide.index} preview — {slide.role}
        </DialogTitle>

        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{slide.role}</Badge>
            <span className="text-xs text-white/80 drop-shadow">
              Slide {slide.index} of {total}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          {/* 1:1 square slide preview */}
          <div
            className="relative mx-auto flex aspect-square w-full max-w-[640px] flex-col justify-between overflow-hidden rounded-2xl p-10 shadow-2xl"
            style={{ backgroundColor: bg, color: fg }}
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ backgroundColor: accent, color: bg }}
              >
                {slide.role}
              </span>
              <span className="text-xs opacity-60">
                {slide.index} / {total}
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-4 py-6">
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {slide.headline}
              </h2>
              <p className="whitespace-pre-wrap text-base leading-relaxed opacity-90 sm:text-lg">
                {slide.body}
              </p>
            </div>

            <div
              className="border-t pt-3 text-[11px] uppercase tracking-wider opacity-60"
              style={{ borderColor: `${fg}33` }}
            >
              Visual: {slide.visualNote}
            </div>
          </div>

          {/* Prev / next */}
          {hasPrev && (
            <button
              type="button"
              onClick={() => onIndexChange(slide.index - 1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => onIndexChange(slide.index + 1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-white/70 drop-shadow">
          Use ← / → to flip through slides
        </p>
      </DialogContent>
    </Dialog>
  );
}