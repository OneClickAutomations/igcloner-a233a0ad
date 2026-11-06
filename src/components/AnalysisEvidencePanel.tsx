import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Eye, Sparkles } from "lucide-react";
import { getSourceMediaSignedUrls } from "@/lib/analyze.functions";

interface Props {
  analysisId: string | null;
  dna: any;
  blueprint: any | null;
  transcript: string | null;
  analysisConfidence: number | null;
}

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ProvenanceBadge({ p }: { p: "observed" | "inferred" }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        p === "observed" ? "bg-accent-primary/10 text-accent-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {p === "observed" ? "Observed" : "Inferred"}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

/** Observed evidence for new analyses: hook, caption structure, slides, shots, transcript, confidence. */
export function AnalysisEvidencePanel({ analysisId, dna, blueprint, transcript, analysisConfidence }: Props) {
  const signFn = useServerFn(getSourceMediaSignedUrls);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!analysisId || !blueprint?.slides?.length) return;
    signFn({ data: { analysisId } })
      .then((r: any) => setThumbs(Object.fromEntries((r.media ?? []).map((m: any) => [m.path, m.signedUrl]))))
      .catch(() => {});
  }, [analysisId, blueprint, signFn]);

  if (!blueprint) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This analysis was made before media-based analysis. Details below are inferred, not read from the saved media.
      </div>
    );
  }

  const hook = dna?.hookBreakdown ?? {};
  const cap = dna?.captionDNA ?? {};
  const limitations: string[] = dna?.limitations ?? [];
  const provenance: any[] = dna?.forensics?.provenance ?? [];
  const perf = dna?.performanceBasis;

  return (
    <div className="space-y-4">
      <Card title="Analysis confidence">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold text-accent-primary">{analysisConfidence ?? "—"}</span>
          <span className="text-xs text-muted-foreground">/ 100 — how much of this was read from the real media</span>
        </div>
        {limitations.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-status-warning">
            {limitations.map((l, i) => <li key={i}>· {l}</li>)}
          </ul>
        )}
        {perf?.formula && <p className="mt-2 text-[11px] text-muted-foreground">Performance: {perf.formula}</p>}
      </Card>

      <Card title="The hook">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-md bg-accent-primary/10 px-2 py-0.5 text-xs font-medium text-accent-primary">{hook.mechanism || hook.type}</span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{hook.location}</span>
          <span className="ml-auto font-mono text-sm font-bold text-accent-primary">{hook.score}/10</span>
        </div>
        <p className="whitespace-pre-line text-base font-semibold">“{hook.exactText}”</p>
        {hook.whyItWorks && <p className="mt-2 text-sm text-secondary-foreground">{hook.whyItWorks}</p>}
        {hook.scoreReasoning && <p className="mt-1 text-xs text-muted-foreground">{hook.scoreReasoning}</p>}
      </Card>

      <Card title="Caption structure">
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {[
            ["Hook line", cap.hookLine],
            ["Body pattern", cap.bodyPattern],
            ["Line breaks", cap.lineBreakRhythm],
            ["Length", blueprint.caption?.exact ? `${blueprint.caption.exact.length} chars · ${blueprint.caption.exact.trim().split(/\s+/).length} words` : "No caption"],
            ["Emoji", cap.emojiUsage],
            ["Hashtags", `${blueprint.caption?.hashtags?.length ?? 0} · ${cap.hashtagPlacement || "—"}`],
            ["CTA", cap.ctaLine ? `“${cap.ctaLine}” (${cap.ctaType})` : cap.ctaType],
            ["Keyword trigger", cap.keywordTrigger || "none"],
          ].map(([k, v]) => (
            <div key={k as string} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="text-secondary-foreground break-words">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {blueprint.slides?.length > 0 && (
        <Card title="What we saw">
          <div className="grid gap-3 sm:grid-cols-2">
            {blueprint.slides.map((s: any) => (
              <div key={s.index} className="flex gap-3 rounded-lg border border-border p-2">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded bg-muted">
                  {s.mediaPath && thumbs[s.mediaPath] && <img src={thumbs[s.mediaPath]} alt={`Slide ${s.index + 1}`} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 text-xs">
                  <p className="mb-1 font-semibold">Slide {s.index + 1} · <span className="text-muted-foreground">{s.role}</span></p>
                  <p className="whitespace-pre-line text-secondary-foreground">{s.exactText || <em className="text-muted-foreground">No text on this slide</em>}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {blueprint.scenes?.length > 0 && (
        <Card title="Shot timeline">
          <ol className="space-y-2">
            {blueprint.scenes.map((sc: any, i: number) => (
              <li key={i} className="flex gap-3 text-xs">
                <span className="w-20 shrink-0 font-mono text-accent-primary">{fmt(sc.start)}–{fmt(sc.end)}</span>
                <div className="min-w-0">
                  <p className="text-secondary-foreground">{sc.description}</p>
                  <p className="text-muted-foreground">{[sc.camera, sc.transition].filter(Boolean).join(" · ")}</p>
                  {sc.onScreenText?.map((t: any, j: number) => <p key={j} className="font-medium">“{t.text}”</p>)}
                  {sc.spokenText && <p className="italic text-muted-foreground">Said: {sc.spokenText}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {transcript && (
        <Card title="Transcript">
          <p className="max-h-60 overflow-y-auto whitespace-pre-line text-sm text-secondary-foreground">{transcript}</p>
        </Card>
      )}

      {provenance.length > 0 && (
        <Card title="Forensics">
          <ul className="space-y-1.5">
            {provenance.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <ProvenanceBadge p={f.provenance} />
                <span className="min-w-0"><strong>{f.field}:</strong> <span className="text-secondary-foreground">{f.value}</span>
                  {f.evidence && <span className="text-muted-foreground"> ({f.evidence})</span>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {blueprint.dependencies?.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Can't be recreated exactly: {blueprint.dependencies.join(" · ")}</span>
        </div>
      )}
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" /> Observed = read from the saved media. Inferred = the AI's judgment.</p>
    </div>
  );
}
