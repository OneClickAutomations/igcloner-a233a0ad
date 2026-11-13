// Stable persisted IDs remain independent of user-facing mode names.
export type CloneMethod = "A0" | "A1" | "A2" | "A3";

export const CLONE_LABEL: Record<CloneMethod, string> = {
  A0: "Repost the original",
  A1: "Same post, your words",
  A2: "Remake it",
  A3: "New idea from it",
};

export const CLONE_SUMMARY: Record<CloneMethod, string> = {
  A0: "The original media and caption, unchanged, ready to publish.",
  A1: "The original visuals kept exactly, with new on-image text and a new caption.",
  A2: "Brand-new visuals built from the same idea, with new words.",
  A3: "Same core message, flipped format or platform style, all new media.",
};

// Mode-picker card text: what you get + what it costs.
export const CLONE_BLURB: Record<CloneMethod, string> = {
  A0: "Download the video and caption exactly as posted. Only for your own posts or ones you have permission to share. Free.",
  A1: "Keep the original visuals. We remove the on-screen text and caption and put yours in. 1 credit per slide with text.",
  A2: "We recreate the video shot by shot with a new person — same setting, same action, same timing. Change the outfit, look or words if you want. Images 1 credit each · video 15–25 credits.",
  A3: "Keep what made it work — the hook, pacing and structure — and turn it into something new for your niche. Images 1 credit each · video 15–25 credits.",
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
