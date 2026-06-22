import { useRef } from "react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  SWIPE_INDICATOR_TEMPLATES,
  type BrandingPosition,
  type BrandingSettings,
  type SwipeIndicatorStyle,
} from "@/lib/branding";

const POSITIONS: { value: BrandingPosition; label: string }[] = [
  { value: "top-left", label: "Top L" },
  { value: "top-center", label: "Top C" },
  { value: "top-right", label: "Top R" },
  { value: "bottom-left", label: "Bot L" },
  { value: "bottom-center", label: "Bot C" },
  { value: "bottom-right", label: "Bot R" },
];

function PositionGrid({
  value,
  onChange,
  label,
}: {
  value: BrandingPosition;
  onChange: (p: BrandingPosition) => void;
  label: string;
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {POSITIONS.map((p) => {
          const active = value === p.value;
          const [v, h] = p.value.split("-");
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              aria-pressed={active}
              className={`relative aspect-[5/3] rounded-md border text-[10px] transition ${
                active
                  ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary"
                  : "border-border bg-muted/40 hover:border-strong"
              }`}
              title={p.label}
            >
              <span
                className={`absolute h-1.5 w-3 rounded-sm ${active ? "bg-accent-primary" : "bg-foreground/50"}`}
                style={{
                  top: v === "top" ? 6 : undefined,
                  bottom: v === "bottom" ? 6 : undefined,
                  left: h === "left" ? 6 : h === "center" ? "50%" : undefined,
                  right: h === "right" ? 6 : undefined,
                  transform: h === "center" ? "translateX(-50%)" : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BrandingPanel({
  settings,
  onChange,
}: {
  settings: BrandingSettings;
  onChange: (s: BrandingSettings) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof BrandingSettings>(k: K, v: BrandingSettings[K]) =>
    onChange({ ...settings, [k]: v });

  const onLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => set("logoUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-ig">
      <div>
        <h3 className="text-base font-semibold">Branding</h3>
        <p className="text-xs text-muted-foreground">
          Applied to the live preview and Canva export instructions.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Your handle</Label>
          <Input
            value={settings.handle}
            onChange={(e) => set("handle", e.target.value)}
            placeholder="@yourbrand"
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Label className="text-xs">Show handle on slides</Label>
          <Switch checked={settings.showHandle} onCheckedChange={(v) => set("showHandle", v)} />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show logo on slides</Label>
            <Switch checked={settings.showLogo} onCheckedChange={(v) => set("showLogo", v)} />
          </div>
          {settings.showLogo && (
            <div className="mt-2 flex items-center gap-2">
              {settings.logoUrl && (
                <img
                  src={settings.logoUrl}
                  alt="Logo preview"
                  className="h-9 w-9 rounded-md border border-border object-cover"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {settings.logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {settings.logoUrl && (
                <Button size="sm" variant="ghost" onClick={() => set("logoUrl", null)}>
                  Remove
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogoFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>
      </div>

      <PositionGrid
        label="Branding position"
        value={settings.position}
        onChange={(p) => set("position", p)}
      />

      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Swipe indicator</h4>
            <p className="text-[11px] text-muted-foreground">Shown on every slide except the last.</p>
          </div>
          <Switch
            checked={settings.swipeIndicatorEnabled}
            onCheckedChange={(v) => set("swipeIndicatorEnabled", v)}
          />
        </div>

        {settings.swipeIndicatorEnabled && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(SWIPE_INDICATOR_TEMPLATES) as SwipeIndicatorStyle[]).map((k) => {
                const tpl = SWIPE_INDICATOR_TEMPLATES[k];
                const active = settings.swipeIndicatorStyle === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set("swipeIndicatorStyle", k)}
                    className={`rounded-lg border p-2 text-xs transition ${
                      active
                        ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary"
                        : "border-border bg-muted/40 hover:border-strong"
                    }`}
                  >
                    <div className="text-sm font-semibold">{tpl.render() || "—"}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{tpl.label}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <PositionGrid
                label="Indicator position"
                value={settings.swipeIndicatorPosition}
                onChange={(p) => set("swipeIndicatorPosition", p)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}