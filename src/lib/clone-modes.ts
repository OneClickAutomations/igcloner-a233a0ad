// Stable persisted IDs remain independent of user-facing mode names.
export type CloneMethod = "A0" | "A1" | "A2" | "A3";

export const CLONE_LABEL: Record<CloneMethod, string> = {
  A0: "Exact copy",
  A1: "Same look, new words",
  A2: "New look, same idea",
  A3: "Remix the message",
};

export const CLONE_SUMMARY: Record<CloneMethod, string> = {
  A0: "The original media and caption, unchanged, ready to publish.",
  A1: "The original visuals kept exactly, with new on-image text and a new caption.",
  A2: "Brand-new visuals built from the same idea, with new words.",
  A3: "Same core message, flipped format or platform style, all new media.",
};

// Mode-picker card text: what you get + what it costs.
export const CLONE_BLURB: Record<CloneMethod, string> = {
  A0: "You get the original photos or video and the original caption, byte-for-byte. Free — no AI is used.",
  A1: "You get the same picture with the original text removed and your new text in its place, plus a new caption. 1 credit per slide that has text; slides without text are free.",
  A2: "You get new images or video made in the same style, with new words. You can mix up to 3 reference images. 1 credit per image; video 15–25 credits.",
  A3: "You get the same message turned into a new format or angle, with new media and words. 1 credit per image; video 15–25 credits.",
};

// Display order: A0 → A1 → A2 → A3.
export const CLONE_METHODS = (["A0", "A1", "A2", "A3"] as const).map((id) => ({
  id,
  title: CLONE_LABEL[id],
  blurb: CLONE_BLURB[id],
}));

export function isCloneMethod(id: unknown): id is CloneMethod {
  return id === "A0" || id === "A1" || id === "A2" || id === "A3";
}

export function cloneModeLabel(id: string | null | undefined): string {
  if (isCloneMethod(id)) return CLONE_LABEL[id];
  return id ?? "";
}
