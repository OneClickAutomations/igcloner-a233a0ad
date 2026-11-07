import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateCloneVersions, makeItBetter } from "@/lib/analyze.functions";
import { ACTION_COSTS, parseInsufficientCredits } from "@/lib/credits";

interface Props {
  analysisId: string;
  clones: any[];
  onClones: (c: any[]) => void;
  onCredits: () => void;
}

/** The 5 angle versions — generated on demand (1 credit), free once they exist. */
export function CloneVersionsPanel({ analysisId, clones, onClones, onCredits }: Props) {
  const genFn = useServerFn(generateCloneVersions);
  const sharpenFn=useServerFn(makeItBetter);
  const [sharpening,setSharpening]=useState<number|null>(null);
  const [changes,setChanges]=useState<Record<number,any>>({});
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res: any = await genFn({ data: { analysisId } });
      if (!res.ok) {
        const insuff = parseInsufficientCredits(res.error);
        toast.error(insuff ? `You need ${insuff.required} credit and have ${insuff.available}.` : res.error);
      } else {
        onClones(res.clones);
        toast.success(res.charged ? `5 versions ready — ${res.charged} credit used` : "Versions loaded — no credits used");
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate versions");
    } finally {
      setBusy(false);
      onCredits();
    }
  };

  if (clones.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-semibold">5 ready-to-post versions</p>
          <p className="text-xs text-muted-foreground">Direct, contrarian, story, authority and curiosity takes on this post, written from its real hook and caption.</p>
        </div>
        <Button size="sm" onClick={generate} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Writing versions…" : `Generate 5 versions (${ACTION_COSTS.captionPack} credit)`}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">5 versions</h4>
      <div className="grid gap-3 md:grid-cols-2">
        {clones.map((c) => (
          <div key={c.versionNumber} className="rounded-lg border border-border p-3 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="rounded-md bg-accent-primary/10 px-2 py-0.5 text-xs font-medium text-accent-primary">{c.angleLabel}</span>
              <button
                aria-label={`Copy version ${c.versionNumber} caption`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => { navigator.clipboard.writeText(c.caption); toast.success("Caption copied"); }}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="font-semibold">{c.hook}</p>
            <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-xs text-secondary-foreground">{c.caption}</p>
            <Button size="sm" variant="outline" disabled={sharpening!==null} className="mt-2" onClick={async()=>{setSharpening(c.versionNumber);try{const r=await sharpenFn({data:{analysisId,versionNumber:c.versionNumber}});setChanges(old=>({...old,[c.versionNumber]:r.improved}));onClones(clones.map(x=>x.versionNumber===c.versionNumber?{...x,hook:r.improved.improvedHook,caption:r.improved.improvedCaption,cta:r.improved.improvedCta}:x));toast.success("Copy sharpened");}catch(e){toast.error(e instanceof Error?e.message:"Sharpen failed");}finally{setSharpening(null);onCredits();}}}>{sharpening===c.versionNumber?"Sharpening…":`Sharpen (${ACTION_COSTS.sharpen} credits)`}</Button>
            {changes[c.versionNumber]&&<details className="mt-2 text-xs"><summary>Before / after & changes</summary><p className="mt-2 whitespace-pre-line">Before: {changes[c.versionNumber].before.caption}</p><ul className="mt-2 list-disc pl-4">{changes[c.versionNumber].improvements.map((t:string,i:number)=><li key={i}>{t}</li>)}</ul><p className="mt-2">Rubric: {changes[c.versionNumber].scoresBefore.average.toFixed(1)} → {changes[c.versionNumber].scoresAfter.average.toFixed(1)}/10</p></details>}
          </div>
        ))}
      </div>
    </div>
  );
}
