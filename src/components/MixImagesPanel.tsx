import { useGenJob } from "./useGenJob";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Layers, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listSourceSlides, mixImages } from "@/lib/clone-copy.functions";
import { uploadReferenceImage } from "@/lib/reference-upload.functions";
import { CREDIT_BALANCE_KEY, parseInsufficientCredits } from "@/lib/credits";

type Ref = { kind: "slide" | "asset"; slideIndex?: number; path?: string; preview: string; role: string };

export function MixImagesPanel({ projectId, onCreated }: { projectId: string; onCreated: (asset: any) => void }) {
  const qc = useQueryClient();
  const slidesFn = useServerFn(listSourceSlides);
  const mixFn = useServerFn(mixImages);
  const gen = useGenJob();
  const uploadFn = useServerFn(uploadReferenceImage);
  const [open, setOpen] = useState(false);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [instruction, setInstruction] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ["source-slides", projectId], queryFn: () => slidesFn({ data: { projectId } }), enabled: open });

  const add = (r: Ref) => setRefs((x) => (x.length >= 3 ? x : [...x, r]));

  const upload = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) { toast.error("Use an image under 10MB"); return; }
    const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
    try {
      const out = await uploadFn({ data: { analysisId: null as any, filename: f.name, mediaType: f.type, dataBase64: b64 } });
      add({ kind: "asset", path: out.path, preview: out.url, role: "" });
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = async () => {
    if (refs.length < 2) { toast.error("Add at least 2 reference images"); return; }
    if (refs.some((r) => r.role.trim().length < 2)) { toast.error("Say what to take from each image"); return; }
    setBusy(true);
    try {
      const r = await gen.run({ slot: "mix", title: "Your mixed image", stage: `Blending ${refs.length} images…`, expectedSeconds: 40, doneLabel: "Your mixed image is ready", paid: true, resultSelector: "#mix-result" }, () => mixFn({ data: { projectId, refs: refs.map(({ kind, slideIndex, path, role }) => ({ kind, slideIndex, path, role })), instruction: instruction || "Combine the roles into one cohesive image.", text: text || undefined } }));
      setResult(r.url);
      onCreated(r.asset);
    } catch (e: any) {
      const ic = parseInsufficientCredits(e);
      toast.error(ic ? `You need ${ic.required} credit — you have ${ic.available}.` : e?.message ?? "Mix failed");
    } finally { setBusy(false); qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY }); }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-accent-primary" /> Mix images <span className="text-[11px] font-normal text-muted-foreground">up to 3 · 1 credit</span></span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {(data?.slides?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground">From the source post</p>
              <div className="mt-1 flex gap-1.5 overflow-x-auto">
                {data!.slides.map((s) => s.url && (
                  <button key={s.index} type="button" onClick={() => add({ kind: "slide", slideIndex: s.index, preview: s.url!, role: "" })} className="h-14 w-14 shrink-0 overflow-hidden rounded border border-border hover:ring-2 hover:ring-accent-primary">
                    <img src={s.url} alt={`Source slide ${s.index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={refs.length >= 3} className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload your own</Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          {refs.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold">#{i + 1}</span>
              <img src={r.preview} alt={`Reference ${i + 1}`} className="h-10 w-10 rounded object-cover" />
              <Input value={r.role} onChange={(e) => setRefs((x) => x.map((y, j) => (j === i ? { ...y, role: e.target.value } : y)))} placeholder={["the subject", "the background style", "the color palette"][i]} className="h-8 text-xs" />
              <button type="button" onClick={() => setRefs((x) => x.filter((_, j) => j !== i))} aria-label="Remove reference"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          ))}
          <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} className="text-xs" placeholder='How to combine, e.g. "subject from #1, background style from #2, palette from #3"' />
          <Input value={text} onChange={(e) => setText(e.target.value)} className="h-8 text-xs" placeholder="Optional text on the image" />
          <Button onClick={run} disabled={busy || refs.length < 2} className="w-full gap-1.5"><Layers className="h-4 w-4" /> Mix ({refs.length}/3)</Button>{gen.ring("mix")}
          {result && (
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[10px] text-muted-foreground">Before</p><div className="grid grid-cols-3 gap-1">{refs.map((r, i) => <img key={i} src={r.preview} alt={`Before ${i + 1}`} className="aspect-square w-full rounded object-cover" />)}</div></div>
              <div><p className="text-[10px] text-muted-foreground">After</p><img src={result} alt="Mixed result" className="w-full rounded" /></div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Makes new media — don't use other people's faces or logos you don't have rights to.</p>
        </div>
      )}
    </div>
  );
}
