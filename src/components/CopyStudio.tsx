import { useEffect, useState } from "react";
import { useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCopyProject, rewriteSameLookCopy, generateSameLookSlide, saveCopyDraft, buildSameLookVoiceover } from "@/lib/clone-copy.functions";
import { publishContent } from "@/lib/publishing.functions";
import { VOICE_CATALOG } from "@/lib/voiceover.functions";
import { CREDIT_BALANCE_KEY, parseInsufficientCredits } from "@/lib/credits";
import { CLONE_LABEL } from "@/lib/clone-modes";

type SlideResult = { url: string | null; passed: boolean; problems: string[]; attempts: number; observedText: string; charged: number };

export function CopyStudio() {
  const { projectId } = useSearch({ from: "/_authenticated/studio/copy" });
  const qc = useQueryClient();
  const getFn = useServerFn(getCopyProject);
  const rewriteFn = useServerFn(rewriteSameLookCopy);
  const slideFn = useServerFn(generateSameLookSlide);
  const saveFn = useServerFn(saveCopyDraft);
  const publishFn = useServerFn(publishContent);
  const voFn = useServerFn(buildSameLookVoiceover);
  const { data, refetch } = useQuery({ queryKey: ["copy-project", projectId], queryFn: () => getFn({ data: { projectId } }) });

  const project: any = data?.project;
  const pd = project?.project_data ?? {};
  const mode: "A0" | "A1" = pd.copyMode === "A0" ? "A0" : "A1";
  const isVideo = project?.format === "reel";

  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [newText, setNewText] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, SlideResult>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [voice, setVoice] = useState(VOICE_CATALOG[2].id);
  const [vo, setVo] = useState<{ script: string; audioUrl: string | null; videoUrl: string | null; muxError: string | null } | null>(null);

  useEffect(() => {
    if (!project) return;
    setCaption(pd.caption ?? "");
    setTags((pd.hashtags ?? []).map((h: string) => `#${h}`).join(" "));
    setNewText(pd.newText ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const hashtags = tags.split(/\s+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
  const slides = data.slides ?? [];
  const latestBySlide = new Map<number, any>();
  for (const a of data.assets) if (a.source === "same_look" && a.metadata?.slideIndex != null) latestBySlide.set(a.metadata.slideIndex, a);
  const exactAssets = data.assets.filter((a: any) => a.source === "exact_copy").sort((x: any, y: any) => (x.metadata?.order ?? 0) - (y.metadata?.order ?? 0));

  // Final media in slide order: A0 = copied files; A1 = edited slide when present, else original.
  const finalMedia: { url: string; kind: string }[] = mode === "A0"
    ? exactAssets.map((a: any) => ({ url: a.url, kind: a.type }))
    : isVideo
      ? data.assets.filter((a: any) => a.type === "video").slice(-1).map((a: any) => ({ url: a.url, kind: "video" }))
      : slides.map((s: any) => ({ url: results[s.index]?.url ?? latestBySlide.get(s.index)?.url ?? s.originalUrl, kind: "image" })).filter((m: any) => m.url);

  const save = async () => {
    await saveFn({ data: { projectId, caption, hashtags, newText: Object.fromEntries(Object.entries(newText).map(([k, v]) => [k, v])) } });
  };

  const rewrite = async (what: "slides" | "caption" | "both") => {
    setBusy(`rewrite-${what}`);
    try {
      const r = await rewriteFn({ data: { projectId, what } });
      if (r.texts) setNewText((t) => ({ ...t, ...r.texts }));
      if (r.caption) { setCaption(r.caption); setTags((r.hashtags ?? []).map((h) => `#${h}`).join(" ")); }
    } catch (e: any) { toast.error(e?.message ?? "Rewrite failed"); } finally { setBusy(null); }
  };

  const genSlide = async (index: number) => {
    const text = (newText[index] ?? "").trim();
    if (!text) { toast.error("Type the new text first"); return; }
    setBusy(`slide-${index}`);
    try {
      const r = await slideFn({ data: { projectId, slideIndex: index, newText: text } });
      setResults((x) => ({ ...x, [index]: r as SlideResult }));
      if (r.passed) toast.success(`Slide ${index + 1} ready (${r.attempts} attempt${r.attempts > 1 ? "s" : ""})`);
      else toast.warning(`Slide ${index + 1} needs a look — credit refunded`);
      await save();
    } catch (e: any) {
      const ic = parseInsufficientCredits(e);
      toast.error(ic ? `You need ${ic.required} credit — you have ${ic.available}.` : e?.message ?? "Generation failed");
    } finally { setBusy(null); qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY }); }
  };

  const toPublishing = async () => {
    setBusy("publish");
    try {
      await save();
      if (!finalMedia.length) throw new Error("No media yet");
      await publishFn({ data: {
        contentType: isVideo ? "reel" : finalMedia.length > 1 ? "carousel" : "image",
        title: project.title, captionPerPlatform: { instagram: caption }, hashtagsPerPlatform: { instagram: hashtags },
        mediaUrls: finalMedia.map((m) => m.url), platforms: ["instagram"], projectId, saveAsDraft: true,
      } as any });
      toast.success("Saved as a draft in Publishing Center");
    } catch (e: any) { toast.error(e?.message ?? "Couldn't save draft"); } finally { setBusy(null); }
  };

  const makeVoiceover = async () => {
    setBusy("vo");
    try {
      const r = await voFn({ data: { projectId, voiceId: voice, script: vo?.script || undefined } });
      setVo(r);
      if (r.muxError) toast.warning(r.muxError); else toast.success("Video with new voiceover ready");
      refetch();
    } catch (e: any) { toast.error(e?.message ?? "Voiceover failed"); } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Projects</Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{CLONE_LABEL[mode]}</h1>
          <p className="text-sm text-muted-foreground">{project.source_account ? `From @${project.source_account}` : "From your analyzed post"} · {mode === "A0" ? "Free — original files, unchanged" : "1 credit per slide that has text"}</p>
        </div>
      </div>

      {data.dependencies.length > 0 && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Before you publish</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{data.dependencies.map((d: string) => <li key={d}>{d}</li>)}</ul>
          {isVideo && mode === "A0" && <p className="mt-1 text-xs text-muted-foreground">The original audio, including any music, is kept as-is.</p>}
        </div>
      )}

      {mode === "A1" && !isVideo && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Slides</h2>
            <Button size="sm" variant="outline" onClick={() => rewrite("slides")} disabled={!!busy} className="gap-1.5">
              {busy === "rewrite-slides" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Rewrite all for me
            </Button>
          </div>
          {slides.map((s: any) => {
            const r = results[s.index];
            const prev = latestBySlide.get(s.index);
            const outUrl = r?.url ?? prev?.url;
            const needsLook = r ? !r.passed : prev ? prev.metadata?.passed === false : false;
            const problems = r?.problems ?? prev?.metadata?.problems ?? [];
            return (
              <div key={s.index} className="grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_1fr]">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Slide {s.index + 1}{s.role ? ` · ${s.role}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <figure><img src={s.originalUrl} alt={`Original slide ${s.index + 1}`} className="w-full rounded-md border border-border" /><figcaption className="mt-1 text-[10px] text-muted-foreground">Original</figcaption></figure>
                    <figure>{outUrl ? <img src={outUrl} alt={`New slide ${s.index + 1}`} className="w-full rounded-md border border-border" /> : <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">{s.exactText ? "Not generated" : "Used as-is"}</div>}<figcaption className="mt-1 text-[10px] text-muted-foreground">New</figcaption></figure>
                  </div>
                </div>
                <div className="space-y-2">
                  {s.exactText ? (
                    <>
                      <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Original text</p><p className="whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{s.exactText}</p></div>
                      <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">New text</p>
                        <Textarea value={newText[s.index] ?? ""} onChange={(e) => setNewText((t) => ({ ...t, [s.index]: e.target.value }))} rows={3} className="text-sm" placeholder="Type your text, or use Rewrite" /></div>
                      <Button size="sm" onClick={() => genSlide(s.index)} disabled={!!busy} className="w-full gap-1.5">
                        {busy === `slide-${s.index}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {outUrl ? "Regenerate" : "Generate"} (1 credit)
                      </Button>
                      {outUrl && !needsLook && <p className="flex items-center gap-1 text-xs text-status-success"><CheckCircle2 className="h-3.5 w-3.5" /> Text checked: matches exactly, original text gone.</p>}
                      {needsLook && <div className="rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-xs"><p className="font-semibold">Needs a look — credit refunded</p>{problems.map((p: string) => <p key={p} className="text-muted-foreground">{p}</p>)}</div>}
                    </>
                  ) : <p className="text-xs text-muted-foreground">No text on this slide — it stays exactly as the original, free.</p>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {mode === "A1" && isVideo && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">New voiceover over the original video</h2>
          <p className="rounded-md bg-muted p-2 text-xs">Original on-screen text can't be edited for this video. The original audio (including music) is replaced by your new voiceover.</p>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            {VOICE_CATALOG.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.description}</option>)}
          </select>
          {vo && <Textarea value={vo.script} onChange={(e) => setVo({ ...vo, script: e.target.value })} rows={5} className="text-sm" />}
          <Button onClick={makeVoiceover} disabled={!!busy} className="gap-1.5">{busy === "vo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{vo ? "Re-record with this script" : "Write script + record voiceover"}</Button>
          {vo?.audioUrl && <audio controls src={vo.audioUrl} className="w-full" />}
          {vo?.muxError && <p className="text-xs text-status-error">{vo.muxError}</p>}
        </section>
      )}

      {(mode === "A0" || isVideo) && finalMedia.length > 0 && (
        <section className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {finalMedia.map((m, i) => m.kind === "video"
            ? <video key={i} src={m.url} controls className="w-full rounded-md border border-border" />
            : <img key={i} src={m.url} alt={`Media ${i + 1}`} className="w-full rounded-md border border-border" />)}
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Caption</h2>
          {mode === "A1" && <Button size="sm" variant="outline" onClick={() => rewrite("caption")} disabled={!!busy} className="gap-1.5">{busy === "rewrite-caption" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Rewrite like the original</Button>}
        </div>
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={8} className="text-sm" />
        <Textarea value={tags} onChange={(e) => setTags(e.target.value)} rows={2} className="text-xs" placeholder="#hashtags" />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={toPublishing} disabled={!!busy || !finalMedia.length} className="gap-1.5">{busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save to Publishing Center</Button>
        <Button variant="outline" onClick={() => save().then(() => toast.success("Saved to project"))} disabled={!!busy}>Save to project</Button>
      </div>
    </div>
  );
}
