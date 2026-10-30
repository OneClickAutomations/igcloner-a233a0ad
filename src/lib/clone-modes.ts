// Stable persisted IDs remain independent of user-facing mode names.
export type CloneMethod = "A1" | "A2" | "A3";

export const CLONE_LABEL: Record<CloneMethod, string> = {
  A1: "Steal the Frame",
  A2: "Reimagine the Scene",
  A3: "Remix the Message",
};

export const CLONE_SUMMARY: Record<CloneMethod, string> = {
  A1: "Same shot concept, different creator voice.",
  A2: "Same topic, completely different visual approach.",
  A3: "Same core message, flipped format or platform style.",
};

export const CLONE_METHODS = (["A1", "A3", "A2"] as const).map((id) => ({
  id,
  title: CLONE_LABEL[id],
  blurb: CLONE_SUMMARY[id],
}));

export function cloneModeLabel(id: string | null | undefined): string {
  if (id === "A1" || id === "A2" || id === "A3") return CLONE_LABEL[id];
  return id ?? "";
}