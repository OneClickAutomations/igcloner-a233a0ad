import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Copy,
  Download,
  ExternalLink,
  ArrowLeft,
  LayoutGrid,
  Wand2,
  Save,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getProject } from "@/lib/projects.functions";
import {
  generateCarousel,
  regenerateSlide,
  saveCarousel,
  type CarouselDoc,
} from "@/lib/carousel.functions";
import { SlidePreviewDialog } from "@/components/SlidePreviewDialog";
import { PostScheduleModal } from "@/components/PostScheduleModal";
import { Send } from "lucide-react";
import { EnhanceButton } from "@/components/EnhanceButton";
import { generateCarouselSlideImage } from "@/lib/carousel-image.functions";
import { ImageIcon } from "lucide-react";

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function designBriefText(doc: CarouselDoc): string {
  const lines: string[] = [];
  lines.push(`CAROUSEL: ${doc.title}`);
  lines.push("");
  lines.push("== HOOK ==");
  lines.push(doc.hook);
  lines.push("");
  lines.push("== SLIDES ==");
  for (const s of doc.slides) {
    lines.push(`Slide ${s.index} — ${s.role}`);
    lines.push(`  Headline: ${s.headline}`);
    lines.push(`  Body: ${s.body}`);
    lines.push(`  Visual: ${s.visualNote}`);
    lines.push("");
  }
  lines.push("== DESIGN BRIEF ==");
  lines.push(`Palette: ${doc.designBrief.palette}`);
  lines.push(`Typography: ${doc.designBrief.typography}`);
  lines.push(`Layout: ${doc.designBrief.layout}`);
  lines.push(`Mood: ${doc.designBrief.mood}`);
  lines.push(`Overlays: ${doc.designBrief.overlays}`);
  lines.push("");
  lines.push("== CAPTION ==");
  lines.push(doc.caption);
  lines.push("");
  lines.push("== HASHTAGS ==");
  lines.push(doc.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
  return lines.join("\n");
}

export function CarouselStudio() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/studio/carousel" });
  const projectId = (search as any)?.projectId as string | undefined;

  const getProjectFn = useServerFn(getProject);
  const generateFn = useServerFn(generateCarousel);
  const regenFn = useServerFn(regenerateSlide);
  const saveFn = useServerFn(saveCarousel);
  const slideImageFn = useServerFn(generateCarouselSlideImage);

  const { data, isLoading, refetch } = useQuery({
    enabled: !!projectId,
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId! } }),
  });

  const project = (data as any)?.project;
  const [doc, setDoc] = useState<CarouselDoc | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(1);
  const [slideCount, setSlideCount] = useState(7);
  const [angle, setAngle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [regenBusy, setRegenBusy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenInstr, setRegenInstr] = useState("");
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const [imgDirection, setImgDirection] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (project?.project_data) {
      setDoc(project.project_data as CarouselDoc);
    }
  }, [project?.id]);

  const active = useMemo(() => doc?.slides.find((s) => s.index === activeIdx) ?? null, [doc, activeIdx]);
  const cloneMode = (project?.user_preferences as any)?.cloneMode === "inspired" ? "inspired" : "exact";

  if (!projectId) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="mb-4 text-muted-foreground">Missing project. Start from an analysis.</p>
        <Button onClick={() => navigate({ to: "/app" })}>Go to Analyze</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res: any = await generateFn({ data: { projectId, slideCount, angle: angle || undefined } });
      setDoc(res.carousel as CarouselDoc);
      setActiveIdx(1);
      toast.success("Carousel generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegen = async () => {
    if (!active) return;
    setRegenBusy(active.index);
    try {
      const res: any = await regenFn({
        data: { projectId, slideIndex: active.index, instruction: regenInstr || undefined },
      });
      const updated = (res.project?.project_data ?? null) as CarouselDoc | null;
      if (updated) setDoc(updated);
      setRegenInstr("");
      toast.success(`Slide ${active.index} updated`);
    } catch (e: any) {
      toast.error(e?.message || "Regenerate failed");
    } finally {
      setRegenBusy(null);
    }
  };

  const handleGenerateSlideImage = async () => {
    if (!active) return;
    setImgBusy(active.index);
    try {
      const res: any = await slideImageFn({
        data: { projectId, slideIndex: active.index, extraDirection: imgDirection || undefined },
      });
      const updated = (res.project?.project_data ?? null) as CarouselDoc | null;
      if (updated) setDoc(updated);
      toast.success(`Slide ${active.index} image generated`);
    } catch (e: any) {
      toast.error(e?.message || "Image generation failed");
    } finally {
      setImgBusy(null);
    }
  };

  const handleGenerateAllImages = async () => {
    if (!doc) return;
    const missing = doc.slides.filter((s) => !s.imageUrl);
    const targets = missing.length > 0 ? missing : doc.slides;
    if (targets.length === 0) return;
    const confirmMsg =
      missing.length === 0
        ? `Regenerate ALL ${targets.length} slide images? This will overwrite existing images.`
        : `Generate ${targets.length} slide image${targets.length === 1 ? "" : "s"}? This runs one slide at a time and may take a few minutes.`;
    if (!window.confirm(confirmMsg)) return;

    setBatchBusy(true);
    setBatchProgress({ done: 0, total: targets.length });
    let failures = 0;
    for (let i = 0; i < targets.length; i++) {
      const slide = targets[i];
      setImgBusy(slide.index);
      setActiveIdx(slide.index);
      try {
        const res: any = await slideImageFn({
          data: { projectId, slideIndex: slide.index, extraDirection: imgDirection || undefined },
        });
        const updated = (res.project?.project_data ?? null) as CarouselDoc | null;
        if (updated) setDoc(updated);
      } catch (e: any) {
        failures++;
        toast.error(`Slide ${slide.index}: ${e?.message || "failed"}`);
      } finally {
        setBatchProgress({ done: i + 1, total: targets.length });
      }
    }
    setImgBusy(null);
    setBatchBusy(false);
    if (failures === 0) toast.success(`All ${targets.length} slides generated — ready to post`);
    else toast.warning(`${targets.length - failures}/${targets.length} slides generated. Retry the failed ones.`);
    setTimeout(() => setBatchProgress(null), 4000);
  };

  const updateSlideField = (field: "headline" | "body" | "visualNote", value: string) => {
    if (!doc || !active) return;
    setDoc({
      ...doc,
      slides: doc.slides.map((s) => (s.index === active.index ? { ...s, [field]: value } : s)),
    });
  };

  const updateDocField = <K extends keyof CarouselDoc>(field: K, value: CarouselDoc[K]) => {
    if (!doc) return;
    setDoc({ ...doc, [field]: value });
  };

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await saveFn({ data: { projectId, carousel: doc } });
      toast.success("Saved");
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate({ to: "/projects" })}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Projects
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-accent text-white shadow-ig">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {doc?.title || project?.title || "Carousel Studio"}
            </h1>
          {project && (
            <Badge variant="secondary" className="ml-2 text-[10px] uppercase tracking-wide">
              {cloneMode === "inspired" ? "Inspired" : "Exact Duplicate"}
            </Badge>
          )}
          </div>
          {project?.source_account && (
            <p className="mt-1 text-xs text-muted-foreground">
              Based on @{project.source_account}
            </p>
          )}
        </div>
        {doc && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(designBriefText(doc), "Brief copied")}>
              <Copy className="h-3.5 w-3.5" /> Brief
            </Button>
            <Button
              size="sm"
              onClick={() => download(`${doc.title.replace(/\W+/g, "-")}.txt`, designBriefText(doc))}
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button
              size="sm"
              className="gap-1.5 gradient-accent text-white border-0 hover:opacity-95"
              onClick={() => setPostOpen(true)}
            >
              <Send className="h-3.5 w-3.5" /> Post Now
            </Button>
          </div>
        )}
      </div>

      {doc && (
        <PostScheduleModal
          open={postOpen}
          onOpenChange={setPostOpen}
          caption={doc.caption}
          hashtags={doc.hashtags}
          format="carousel"
        />
      )}

      {!doc ? (
        // ============ Initial Generate panel ============
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-ig">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
            Generate carousel from DNA
          </div>
          <h2 className="text-lg font-semibold">Set up your carousel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We'll generate slide copy, a caption, hashtags, and a full design brief you can hand to Canva.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="slideCount" className="text-xs font-medium">Number of slides</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[5, 7, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSlideCount(n)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      slideCount === n
                        ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                        : "border-border bg-card hover:border-strong"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="angle" className="text-xs font-medium">
                Optional angle / topic to emphasize
              </Label>
              <Textarea
                id="angle"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="e.g. Focus on first-time founders raising under $500k"
                rows={3}
                className="mt-2"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full" size="lg">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> Generate carousel
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        // ============ Two-column editor ============
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Slide list */}
          <aside className="space-y-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Slides ({doc.slides.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDoc(null);
                }}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3" /> Restart
              </Button>
            </div>
            <Button
              onClick={handleGenerateAllImages}
              disabled={batchBusy || generating}
              size="sm"
              className="w-full gap-1.5 gradient-accent text-white border-0 hover:opacity-95"
            >
              {batchBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {batchProgress ? `Generating ${batchProgress.done}/${batchProgress.total}…` : "Generating…"}
                </>
              ) : (
                <>
                  <ImageIcon className="h-3.5 w-3.5" />
                  {doc.slides.every((s) => s.imageUrl) ? "Regenerate all images" : "Generate all images"}
                </>
              )}
            </Button>
            {batchProgress && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-accent-primary transition-all"
                  style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-2">
              {doc.slides.map((s) => (
                <div
                  key={s.index}
                  className={`group relative flex w-full items-start gap-3 rounded-xl border p-3 transition-colors ${
                    activeIdx === s.index
                      ? "border-accent-primary bg-accent-primary/5"
                      : "border-border bg-card hover:border-strong"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveIdx(s.index)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    {s.imageUrl ? (
                      <img
                        src={s.imageUrl}
                        alt={`Slide ${s.index}`}
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {s.index}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{s.role}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium">{s.headline}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIdx(s.index);
                    }}
                    aria-label={`Enlarge slide ${s.index}`}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Editor */}
          <section className="space-y-6">
            {active && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Slide {active.index} · {active.role}
                    </div>
                    <h2 className="text-lg font-semibold">Edit slide</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewIdx(active.index)}
                      title="Enlarge slide preview"
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> Enlarge
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(`${active.headline}\n\n${active.body}`)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Headline</Label>
                    <Input
                      value={active.headline}
                      onChange={(e) => updateSlideField("headline", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Body</Label>
                    <Textarea
                      value={active.body}
                      onChange={(e) => updateSlideField("body", e.target.value)}
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Visual direction</Label>
                    <Textarea
                      value={active.visualNote}
                      onChange={(e) => updateSlideField("visualNote", e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <Label className="text-xs">Regenerate with AI</Label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={regenInstr}
                      onChange={(e) => setRegenInstr(e.target.value)}
                      placeholder="Optional: 'punchier hook', 'add a stat', etc."
                    />
                    <EnhanceButton
                      value={regenInstr}
                      onChange={setRegenInstr}
                      kind="carousel-slide"
                      context={`Slide ${active.index} — ${active.headline}\n${active.body}`}
                    />
                    <Button onClick={handleRegen} disabled={regenBusy === active.index}>
                      {regenBusy === active.index ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs">Designed slide image</Label>
                    {active.imageUrl && (
                      <a
                        href={active.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-accent-primary hover:underline"
                      >
                        Open full size
                      </a>
                    )}
                  </div>
                  {active.imageUrl ? (
                    <div className="mb-2 overflow-hidden rounded-lg border border-border bg-muted">
                      <img
                        src={active.imageUrl}
                        alt={`Slide ${active.index} design`}
                        className="aspect-square w-full object-cover"
                      />
                    </div>
                  ) : (
                    <p className="mb-2 text-xs text-muted-foreground">
                      AI will enhance the visual direction 10x and design a 1:1 slide image using the carousel's palette, typography, layout, and mood.
                    </p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={imgDirection}
                      onChange={(e) => setImgDirection(e.target.value)}
                      placeholder="Optional: 'more minimalist', 'add a chart', 'magazine cover style'…"
                    />
                    <Button
                      onClick={handleGenerateSlideImage}
                      disabled={imgBusy === active.index}
                      className="gradient-accent text-white border-0 hover:opacity-95"
                    >
                      {imgBusy === active.index ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5" />
                      )}
                      {active.imageUrl ? "Regenerate image" : "Generate slide image"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Caption + hashtags */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
              <h3 className="mb-3 text-base font-semibold">Caption & hashtags</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Caption</Label>
                  <Textarea
                    value={doc.caption}
                    onChange={(e) => updateDocField("caption", e.target.value)}
                    rows={6}
                    className="mt-1"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => copy(doc.caption, "Caption copied")}>
                      <Copy className="h-3.5 w-3.5" /> Copy caption
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Hashtags</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {doc.hashtags.map((h, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        #{h.replace(/^#/, "")}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copy(
                          doc.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
                          "Hashtags copied",
                        )
                      }
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy hashtags
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Design brief */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Design brief</h3>
                <a
                  href="https://www.canva.com/create/instagram-posts/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-primary hover:underline"
                >
                  Open Canva <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {([
                  ["Palette", "palette"],
                  ["Typography", "typography"],
                  ["Layout", "layout"],
                  ["Mood", "mood"],
                  ["Overlays", "overlays"],
                ] as const).map(([label, key]) => (
                  <div key={key} className="rounded-lg border border-border bg-muted/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm text-foreground">{doc.designBrief[key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      )}

      <SlidePreviewDialog
        doc={doc}
        openIndex={previewIdx}
        onOpenChange={(o) => !o && setPreviewIdx(null)}
        onIndexChange={setPreviewIdx}
      />
    </div>
  );
}