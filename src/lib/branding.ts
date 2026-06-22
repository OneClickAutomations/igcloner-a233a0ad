export type BrandingPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type SwipeIndicatorStyle =
  | "arrow-only"
  | "word-arrow"
  | "finger-emoji"
  | "swipe-left-text"
  | "triple-arrow"
  | "sleek-arrow"
  | "dots-only"
  | "none";

export interface BrandingSettings {
  handle: string;
  showHandle: boolean;
  showLogo: boolean;
  logoUrl: string | null;
  position: BrandingPosition;
  swipeIndicatorEnabled: boolean;
  swipeIndicatorStyle: SwipeIndicatorStyle;
  swipeIndicatorPosition: BrandingPosition;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  handle: "@yourbrand",
  showHandle: true,
  showLogo: false,
  logoUrl: null,
  position: "bottom-right",
  swipeIndicatorEnabled: true,
  swipeIndicatorStyle: "word-arrow",
  swipeIndicatorPosition: "bottom-center",
};

export const SWIPE_INDICATOR_TEMPLATES: Record<
  SwipeIndicatorStyle,
  { label: string; render: () => string }
> = {
  "arrow-only": { label: "Arrow", render: () => "→" },
  "word-arrow": { label: "Swipe →", render: () => "Swipe →" },
  "finger-emoji": { label: "👉", render: () => "👉" },
  "swipe-left-text": { label: "Swipe left for more", render: () => "Swipe left for more" },
  "triple-arrow": { label: "Triple arrow", render: () => "➜ ➜ ➜" },
  "sleek-arrow": { label: "Sleek arrows", render: () => "⟶ ⟶" },
  "dots-only": { label: "Dots only", render: () => "" },
  none: { label: "None", render: () => "" },
};

export const POSITION_STYLES: Record<BrandingPosition, React.CSSProperties> = {
  "top-left": { top: 16, left: 16, textAlign: "left" },
  "top-center": { top: 16, left: "50%", transform: "translateX(-50%)", textAlign: "center" },
  "top-right": { top: 16, right: 16, textAlign: "right" },
  "bottom-left": { bottom: 16, left: 16, textAlign: "left" },
  "bottom-center": { bottom: 16, left: "50%", transform: "translateX(-50%)", textAlign: "center" },
  "bottom-right": { bottom: 16, right: 16, textAlign: "right" },
};

const KEY = (projectId: string) => `igcloner_branding_${projectId}`;

export function loadBranding(projectId: string): BrandingSettings {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  try {
    const raw = window.localStorage.getItem(KEY(projectId));
    if (!raw) return DEFAULT_BRANDING;
    return { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<BrandingSettings>) };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(projectId: string, settings: BrandingSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(projectId), JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function getSlideSwipeIndicator(
  slideIndex: number,
  totalSlides: number,
  branding: BrandingSettings,
): string | null {
  if (!branding.swipeIndicatorEnabled) return null;
  if (branding.swipeIndicatorStyle === "none") return null;
  if (slideIndex === totalSlides - 1) return null;
  const tpl = SWIPE_INDICATOR_TEMPLATES[branding.swipeIndicatorStyle];
  const out = tpl.render();
  return out || null;
}