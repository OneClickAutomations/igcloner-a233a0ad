import { Check, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REEL_STYLES, type ReelStylePreset } from "@/lib/audio-types";

export function ReelStylePresets({
  value,
  onChange,
}: {
  value?: ReelStylePreset;
  onChange: (id: ReelStylePreset) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4 text-accent-primary" />
        <div className="text-sm font-semibold">Reel Style</div>
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Step 2</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Each style seeds visual direction, motion design, voice, music, and sound. You can override anything later.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {REEL_STYLES.map((s) => {
          const selected = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`group relative rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary"
                  : "border-border bg-card hover:border-accent-primary/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{s.label}</div>
                {selected && <Check className="h-3.5 w-3.5 text-accent-primary" />}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {s.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}