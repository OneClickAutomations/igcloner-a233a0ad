// Shared helpers for "content medium" fidelity. The medium is the physical or
// digital format the source post exists in — handwriting on paper, screenshot,
// talking-head video, digital graphic, etc. It's separate from visual style.
// In A1 clone mode the medium must be preserved across angles + studio output.

export type ContentMediumType =
  | "handwriting-on-paper"
  | "handwriting-on-surface"
  | "printed-text-photo"
  | "talking-head-video"
  | "broll-video"
  | "lifestyle-photo"
  | "studio-photo"
  | "product-photo"
  | "screenshot"
  | "digital-graphic"
  | "illustrated"
  | "meme-format"
  | "text-on-video"
  | "animation"
  | "ugc-authentic"
  | "mixed";

export interface ContentMedium {
  primary: ContentMediumType | string;
  secondary?: ContentMediumType | string | null;
  description?: string;
  mediumIsTheMessage?: boolean;
  replicationInstructions?: string;
  mediumSignals?: string[];
}

export const MEDIUM_CATEGORIES_PROMPT = `MEDIUM CATEGORIES (pick the closest):
- "handwriting-on-paper" — content written by hand on physical paper, notebook, notepad
- "handwriting-on-surface" — written on whiteboard, chalkboard, window, skin, etc.
- "printed-text-photo" — photograph of printed text, book pages, signs, labels
- "talking-head-video" — person speaking directly to camera
- "broll-video" — video footage without the creator on screen
- "lifestyle-photo" — real photograph of person in natural environment
- "studio-photo" — professional photograph with controlled lighting/background
- "product-photo" — photograph of a product
- "screenshot" — screenshot of a text message, tweet, app, or website
- "digital-graphic" — designed in Canva/Photoshop, digital typography on background
- "illustrated" — drawings, illustrations, or artwork
- "meme-format" — image macro or meme template
- "text-on-video" — text overlaid on video footage
- "animation" — animated or motion graphic content
- "ugc-authentic" — authentic user-generated content, unpolished, real
- "mixed" — combination of two or more mediums`;

const MEDIUM_LABELS: Record<string, string> = {
  "handwriting-on-paper": "✍️ Handwriting on paper",
  "handwriting-on-surface": "✍️ Handwriting on surface",
  "printed-text-photo": "📄 Photo of printed text",
  "talking-head-video": "🎙️ Talking-head video",
  "broll-video": "🎞️ B-roll video",
  "lifestyle-photo": "📷 Lifestyle photo",
  "studio-photo": "📸 Studio photo",
  "product-photo": "📦 Product photo",
  screenshot: "📱 Screenshot",
  "digital-graphic": "🎨 Digital graphic",
  illustrated: "🖌️ Illustration",
  "meme-format": "😂 Meme format",
  "text-on-video": "🎬 Text on video",
  animation: "✨ Animation",
  "ugc-authentic": "🤳 UGC authentic",
  mixed: "🧩 Mixed media",
};

export function mediumLabel(m?: string | null): string {
  if (!m) return "Unknown medium";
  return MEDIUM_LABELS[m] || m;
}

// Image-generation opening instruction per medium (FIRST line of prompt).
export const MEDIUM_OPENINGS: Record<string, string> = {
  "handwriting-on-paper":
    "Photograph of REAL handwriting in dark ink (black or dark blue) on clean white paper. Genuine, slightly imperfect human handwriting — NOT a handwriting font, NOT digital text. Flat-lay shot from directly above, natural window light, soft shadows along the paper edge. The handwritten text is the only element in frame.",
  "handwriting-on-surface":
    "Photograph of real handwriting on a physical surface (whiteboard / chalkboard / mirror / window). Genuine handwriting strokes, not a digital font. Natural lighting, real-world texture of the surface visible.",
  "printed-text-photo":
    "Photograph of printed text on a real physical surface — book page, sign, label, or printed card. Real paper grain or material texture visible. Shot like a documentary photo, not a digital mockup.",
  screenshot:
    "Authentic smartphone screenshot. Real iOS/Android app chrome around the content (status bar, app UI). Looks like an actual screenshot a user would take — NOT a clean mockup template.",
  "talking-head-video":
    "Single still frame of a person speaking directly to camera, close-medium shot, eye contact with the lens, natural setting.",
  "broll-video":
    "Single still frame of cinematic b-roll footage — no person speaking on screen, atmospheric and observational.",
  "lifestyle-photo":
    "Authentic lifestyle photograph. Natural lighting, real environment, candid moment — not stock-photo posed.",
  "studio-photo":
    "Professional studio photograph. Controlled lighting, clean or intentional backdrop, polished commercial look.",
  "product-photo":
    "Product photograph. The product is the hero of the frame. Clean styling, considered lighting.",
  "digital-graphic":
    "Digital graphic design. Clean typography on a designed background. Professional layout, vector-feeling shapes.",
  illustrated:
    "Hand-drawn illustration or digital artwork. Clearly NOT a photograph — visible brush, line, or illustration style.",
  "meme-format":
    "Classic meme template aesthetic. Bold caption text top and/or bottom, Impact-style or similar meme typography.",
  "text-on-video":
    "Single still frame of video footage with bold caption text overlaid in safe-area.",
  animation:
    "Single still frame of an animated or motion-graphic piece. Flat shapes, clean keyframe-style composition.",
  "ugc-authentic":
    "Raw, unpolished user-generated content. Shot on a phone, real-room lighting, zero production polish.",
  mixed: "",
};

// Strong negative prompts per medium — what the model must NOT produce.
export const MEDIUM_NEGATIVES: Record<string, string> = {
  "handwriting-on-paper":
    "digital typography, computer fonts, handwriting fonts (Caveat, Pacifico, etc.), Canva design, gradient background, colored background, styled quote card, clean perfectly-spaced letters, printed text, vector graphic, illustration of handwriting, simulated paper texture",
  "handwriting-on-surface":
    "digital fonts simulating handwriting, vector illustration, perfectly clean lettering",
  screenshot: "real photograph, illustration, digital art, missing phone UI / app chrome, polished mockup template",
  "digital-graphic": "photograph of a person, real environment, hand-drawn, messy unpolished look",
  "ugc-authentic": "studio lighting, perfect composition, stock-photo look, advertisement polish",
  "lifestyle-photo": "studio backdrop, overly posed stock-photo look, artificial CGI",
  illustrated: "photograph, photorealism",
  "meme-format": "premium typography, design-system polish",
};

// Mediums where the source format IS the content — A1 must preserve them.
const MEDIUM_IS_THE_MESSAGE = new Set<string>([
  "handwriting-on-paper",
  "handwriting-on-surface",
  "screenshot",
  "meme-format",
  "ugc-authentic",
  "printed-text-photo",
]);

export function mediumIsTheMessage(m?: ContentMedium | null): boolean {
  if (!m) return false;
  if (typeof m.mediumIsTheMessage === "boolean") return m.mediumIsTheMessage;
  return MEDIUM_IS_THE_MESSAGE.has(String(m.primary));
}

// Whether the legibility "bold sans-serif" rule should apply for this medium.
// For handwriting / illustration / meme / screenshot we want to PRESERVE the
// medium's native typography instead of forcing a Helvetica-style headline.
export function mediumAllowsDesignTypography(m?: string | null): boolean {
  if (!m) return true;
  return ![
    "handwriting-on-paper",
    "handwriting-on-surface",
    "illustrated",
    "meme-format",
    "screenshot",
    "printed-text-photo",
    "ugc-authentic",
  ].includes(m);
}

// Build the medium-constraint block injected into the angles prompt for A1.
export function buildAnglesMediumConstraint(
  cloneMethod: string | undefined,
  medium: ContentMedium | null | undefined,
): string {
  if (!medium?.primary) return "";
  const primary = String(medium.primary);
  const isA1 = cloneMethod === "A1";
  if (!isA1) {
    return `\nMEDIUM GUIDANCE (A2/A3 — user is free to change medium):\nSource medium was: ${primary}${
      medium.description ? ` — ${medium.description}` : ""
    }. In this mode you may suggest a different medium if it serves the niche better.\n`;
  }

  const opening = MEDIUM_OPENINGS[primary] || "";
  const isMessage = mediumIsTheMessage(medium);

  return `\nMEDIUM CONSTRAINT — NON-NEGOTIABLE FOR A1 MODE:
The source post's medium is: "${primary}"${medium.description ? ` (${medium.description})` : ""}.
ALL 5 angles MUST stay in this exact medium. The medium is part of the formula — changing it defeats the clone.

Rules for "${primary}":
${opening || "Preserve the source medium exactly."}
- Each angle's "contentDirection" must describe HOW to create the piece in this medium (not just the message).
- Each angle's hook must be deliverable in this medium (e.g. short enough to write by hand if handwriting).
${
  isMessage
    ? `- CRITICAL: For this post type the MEDIUM IS THE MESSAGE. Do not suggest a digital quote card, Canva design, or any substitute format.`
    : ""
}
`;
}

// Build the medium-first opening for an image-generation prompt (A1 only).
export function buildImageMediumOpening(
  cloneMethod: string | undefined,
  medium: ContentMedium | null | undefined,
): { opening: string; negatives: string; allowDesignType: boolean; primary: string | null } {
  if (cloneMethod !== "A1" || !medium?.primary) {
    return { opening: "", negatives: "", allowDesignType: true, primary: null };
  }
  const primary = String(medium.primary);
  return {
    opening: MEDIUM_OPENINGS[primary] || medium.description || "",
    negatives: MEDIUM_NEGATIVES[primary] || "",
    allowDesignType: mediumAllowsDesignTypography(primary),
    primary,
  };
}