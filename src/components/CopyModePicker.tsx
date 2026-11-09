import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CLONE_METHODS, type CloneMethod } from "@/lib/clone-modes";
import { RIGHTS_NOTE, RIGHTS_STATEMENT, requiresRights } from "@/lib/clone-rules";
import { confirmRights, createExactCopy, getCopyModeContext, startSameLook } from "@/lib/clone-copy.functions";

type Props = {
  analysisId: string;
  value: CloneMethod;
  onChange: (m: CloneMethod) => void;
  preferences?: Record<string, unknown>;
  onCreated?: (projectId: string) => void;
};

export function CopyModePicker({ analysisId, value, onChange, preferences, onCreated }: Props) {
  const navigate = useNavigate();
  const ctxFn = useServerFn(getCopyModeContext);
  const confirmFn = useServerFn(confirmRights);
  const exactFn = useServerFn(createExactCopy);
  const sameLookFn = useServerFn(startSameLook);
  const { data: ctx, error: ctxError } = useQuery({ queryKey: ["copy-mode-ctx", analysisId], queryFn: () => ctxFn({ data: { analysisId } }) });
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const avail = (m: CloneMethod) => ctx?.modes.find((x) => x.mode === m);
  const needsRights = requiresRights(value);
  const deps = ctx?.dependencies ?? [];

  const proceed = async () => {
    if (!ctx) return;
    setBusy(true);
    try {
      await confirmFn({ data: { analysisId, mode: value as "A0" | "A1", statement: ctx.statement } });
      const res = value === "A0"
        ? await exactFn({ data: { analysisId } })
        : await sameLookFn({ data: { analysisId, preferences } });
      if (onCreated) onCreated(res.projectId);
      else navigate({ to: "/studio/copy", search: { projectId: res.projectId } });
    } catch (e: any) {
      toast.error(String(e?.message ?? "Couldn't start").replace(/^RIGHTS_REQUIRED:\s*/, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="mt-1 text-lg font-bold">How much should change?</h3>
      {ctxError && <p className="mt-2 text-xs text-status-error">Couldn't check which modes this post supports: {(ctxError as Error).message}</p>}
      <div className="mt-3 space-y-2">
        {CLONE_METHODS.map((m) => {
          const a = avail(m.id);
          const disabled = a ? !a.available : false;
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(m.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "border-transparent ring-2 ring-accent-primary bg-accent-primary/5" : "border-border bg-card hover:border-strong"
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-accent-primary" : "border-muted-foreground/40"}`}>
                {active && <span className="h-2 w-2 rounded-full bg-accent-primary" />}
              </span>
              <div className="flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {m.title}
                  {requiresRights(m.id) && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"><Lock className="h-3 w-3" /> Needs permission</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.blurb}</p>
                {a?.reason && <p className={`mt-1 text-xs ${disabled ? "text-status-error" : "text-muted-foreground"}`}>{a.reason}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {needsRights ? (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/40 p-4">
          {deps.length > 0 && (
            <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Check before you use this post</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {deps.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={!!ticked[value]} onCheckedChange={(v) => setTicked((t) => ({ ...t, [value]: v === true }))} className="mt-0.5" />
            <span className="font-medium">{RIGHTS_STATEMENT}</span>
          </label>
          <p className="text-xs text-muted-foreground">{RIGHTS_NOTE}</p>
          <Button onClick={proceed} disabled={!ticked[value] || busy || !ctx || !avail(value)?.available} className="h-11 w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {value === "A0" ? "Make exact copy (free)" : "Open the text editor"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">This makes new media. Don't include other people's faces, logos or music you don't have rights to.</p>
      )}
    </div>
  );
}
