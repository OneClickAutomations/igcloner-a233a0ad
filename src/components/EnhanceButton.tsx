import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Wand2, Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enhancePrompt } from "@/lib/enhance.functions";

type Props = {
  value: string;
  onChange: (next: string) => void;
  kind?: "image" | "carousel-slide" | "reel" | "generic";
  context?: string;
  size?: "sm" | "icon";
  label?: string;
};

export function EnhanceButton({
  value,
  onChange,
  kind = "generic",
  context,
  size = "sm",
  label = "AI Magic",
}: Props) {
  const enhanceFn = useServerFn(enhancePrompt);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setSuggestion(null);
    try {
      const res: any = await enhanceFn({ data: { prompt: value, kind, context } });
      if (!res?.enhanced) throw new Error("No suggestion returned");
      setSuggestion(res.enhanced);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't enhance prompt");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (suggestion) onChange(suggestion);
    setSuggestion(null);
    toast.success("Prompt enhanced ✨");
  };

  return (
    <>
      <Button
        type="button"
        size={size === "icon" ? "icon" : "sm"}
        variant="outline"
        onClick={run}
        disabled={busy}
        title="Enhance this prompt 10x with AI"
        className="border-accent-primary/40 bg-accent-primary/5 text-accent-primary hover:bg-accent-primary/10"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
        {size !== "icon" && <span className="ml-1">{label}</span>}
      </Button>

      {suggestion && (
        <div className="mt-2 rounded-lg border border-accent-primary/40 bg-accent-primary/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent-primary">
            <Sparkles className="h-3.5 w-3.5" /> Enhanced version
          </div>
          <p className="text-sm leading-snug">{suggestion}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={accept}>
              <Check className="h-3.5 w-3.5" /> Use this
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
            <Button size="sm" variant="ghost" onClick={run} disabled={busy}>
              <Wand2 className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        </div>
      )}
    </>
  );
}