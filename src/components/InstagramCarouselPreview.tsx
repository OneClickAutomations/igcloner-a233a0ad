import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Send } from "lucide-react";
import type { CarouselDoc } from "@/lib/carousel.functions";
import {
  POSITION_STYLES,
  getSlideSwipeIndicator,
  type BrandingSettings,
} from "@/lib/branding";

function extractHexes(palette: string): string[] {
  const matches = palette.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) ?? [];
  return matches.slice(0, 5);
}

function RenderedSlide({
  slide,
  index,
  total,
  branding,
  fallbackBg,
  fallbackFg,
  fallbackAccent,
}: {
  slide: CarouselDoc["slides"][number];
  index: number;
  total: number;
  branding: BrandingSettings;
  fallbackBg: string;
  fallbackFg: string;
  fallbackAccent: string;
}) {
  const swipe = getSlideSwipeIndicator(index, total, branding);
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {slide.imageUrl ? (
        <img
          src={slide.imageUrl}
          alt={`Slide ${slide.index}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full flex-col justify-between p-6 text-center"
          style={{ backgroundColor: fallbackBg, color: fallbackFg }}
        >
          <span
            className="self-start rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: fallbackAccent, color: fallbackBg }}
          >
            {slide.role}
          </span>
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <h2 className="text-2xl font-bold leading-tight">{slide.headline}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed opacity-90">{slide.body}</p>
          </div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">{slide.visualNote}</div>
        </div>
      )}

      {/* Branding overlay */}
      {(branding.showHandle || (branding.showLogo && branding.logoUrl)) && (
        <div
          className="pointer-events-none absolute flex items-center gap-1.5 rounded-md bg-black/35 px-2 py-1 text-[11px] font-semibold text-white shadow"
          style={POSITION_STYLES[branding.position]}
        >
          {branding.showLogo && branding.logoUrl && (
            <img src={branding.logoUrl} alt="" className="h-4 w-4 rounded-sm object-cover" />
          )}
          {branding.showHandle && <span>{branding.handle}</span>}
        </div>
      )}

      {/* Swipe indicator */}
      {swipe && (
        <div
          className="pointer-events-none absolute rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white shadow"
          style={POSITION_STYLES[branding.swipeIndicatorPosition]}
        >
          {swipe}
        </div>
      )}
    </div>
  );
}

export function InstagramCarouselPreview({
  doc,
  branding,
}: {
  doc: CarouselDoc;
  branding: BrandingSettings;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(
    typeof window !== "undefined" && !window.localStorage.getItem("igcloner_swipe_hint_seen"),
  );

  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => {
      setShowHint(false);
      try {
        window.localStorage.setItem("igcloner_swipe_hint_seen", "true");
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [showHint]);

  const hexes = extractHexes(doc.designBrief.palette);
  const fallbackBg = hexes[0] ?? "#0F172A";
  const fallbackAccent = hexes[1] ?? "#F59E0B";
  const fallbackFg = hexes[2] ?? "#FFFFFF";

  const total = doc.slides.length;
  const go = (i: number) => {
    if (i < 0 || i > total - 1) return;
    setCurrentIndex(i);
  };

  const onStart = (clientX: number) => {
    startX.current = clientX;
    dragging.current = true;
    if (showHint) {
      setShowHint(false);
      try { window.localStorage.setItem("igcloner_swipe_hint_seen", "true"); } catch { /* ignore */ }
    }
  };
  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    setDragOffset(clientX - startX.current);
  };
  const onEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const stageWidth = stageRef.current?.clientWidth ?? 300;
    const threshold = Math.max(40, stageWidth * 0.18);
    if (dragOffset < -threshold) go(currentIndex + 1);
    else if (dragOffset > threshold) go(currentIndex - 1);
    setDragOffset(0);
  };

  return (
    <div className="mx-auto w-full max-w-[390px] select-none overflow-hidden rounded-2xl border border-border bg-white text-zinc-900 shadow-2xl dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 via-fuchsia-500 to-amber-400" />
        <div className="flex-1 text-sm font-semibold">{branding.handle || "@yourbrand"}</div>
        <div className="text-lg leading-none text-zinc-500">···</div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative aspect-square w-full touch-pan-y overflow-hidden bg-black"
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => dragging.current && onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        style={{ cursor: dragging.current ? "grabbing" : "grab" }}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: `translate3d(calc(${-currentIndex * 100}% + ${dragOffset}px), 0, 0)`,
            transition: dragging.current ? "none" : "transform 280ms cubic-bezier(.22,.61,.36,1)",
          }}
        >
          {doc.slides.map((s, i) => (
            <div key={s.index} className="h-full w-full shrink-0">
              <RenderedSlide
                slide={s}
                index={i}
                total={total}
                branding={branding}
                fallbackBg={fallbackBg}
                fallbackFg={fallbackFg}
                fallbackAccent={fallbackAccent}
              />
            </div>
          ))}
        </div>

        {/* Desktop tap zones */}
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => go(currentIndex - 1)}
          className="absolute inset-y-0 left-0 z-10 hidden w-1/3 md:block"
        />
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => go(currentIndex + 1)}
          className="absolute inset-y-0 right-0 z-10 hidden w-1/3 md:block"
        />

        {/* Visible chevron controls (work on all screen sizes) */}
        {currentIndex > 0 && (
          <button
            type="button"
            aria-label="Previous slide"
            onClick={(e) => { e.stopPropagation(); go(currentIndex - 1); }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white shadow backdrop-blur-sm transition hover:bg-black/65"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {currentIndex < total - 1 && (
          <button
            type="button"
            aria-label="Next slide"
            onClick={(e) => { e.stopPropagation(); go(currentIndex + 1); }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white shadow backdrop-blur-sm transition hover:bg-black/65"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Counter */}
        <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
          {currentIndex + 1}/{total}
        </div>

        {/* Swipe hint */}
        {showHint && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-semibold text-white animate-in fade-in">
            👈 Swipe to preview all slides
          </div>
        )}
      </div>

      {/* Dot indicator */}
      <div className="flex justify-center gap-1.5 py-2">
        {doc.slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === currentIndex ? "w-2.5 bg-sky-500" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-4 px-3 pb-1 pt-1 text-zinc-800 dark:text-zinc-100">
        <Heart className="h-6 w-6" />
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <Bookmark className="ml-auto h-6 w-6" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-4 pt-1 text-sm">
        <span className="font-semibold">{branding.handle || "@yourbrand"}</span>{" "}
        <span className="whitespace-pre-wrap">{doc.caption}</span>
        {doc.hashtags.length > 0 && (
          <div className="mt-1 text-sky-600 dark:text-sky-400">
            {doc.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
          </div>
        )}
      </div>
    </div>
  );
}