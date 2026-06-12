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

  useEffect(() => {
    if (project?.project_data) {
      setDoc(project.project_data as CarouselDoc);
    }
  }, [project?.id]);

  const active = useMemo(() => doc?.slides.find((s) => s.index === activeIdx) ?? null, [doc, activeIdx]);

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
          </div>
        )}
      </div>

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
            <div className="space-y-2">
              {doc.slides.map((s) => (
                <button
                  key={s.index}
                  onClick={() => setActiveIdx(s.index)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    activeIdx === s.index
                      ? "border-accent-primary bg-accent-primary/5"
                      : "border-border bg-card hover:border-strong"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {s.index}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{s.role}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium">{s.headline}</p>
                  </div>
                </button>
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
    </div>
  );
}