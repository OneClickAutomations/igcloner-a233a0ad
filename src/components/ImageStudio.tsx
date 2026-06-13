import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Wand2,
  Image as ImageIcon,
  Download,
  RefreshCw,
  Send,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getProject, updateProject } from "@/lib/projects.functions";
import {
  generateProjectImage,
  generateImageCaption,
  listProjectImages,
} from "@/lib/image.functions";
import { PostScheduleModal } from "@/components/PostScheduleModal";
import { EnhanceButton } from "@/components/EnhanceButton";

const STYLES: { id: string; label: string; emoji: string }[] = [
  { id: "photorealistic", label: "Photorealistic", emoji: "📸" },
  { id: "minimalist", label: "Minimalist", emoji: "⚪" },
  { id: "bold-vibrant", label: "Bold & Vibrant", emoji: "🎨" },
  { id: "cinematic", label: "Cinematic", emoji: "🎬" },
  { id: "editorial", label: "Editorial", emoji: "📰" },
  { id: "3d-render", label: "3D Render", emoji: "🧊" },
  { id: "illustration", label: "Illustration", emoji: "✏️" },
];

const ASPECTS: { id: "1:1" | "4:5" | "9:16" | "16:9"; label: string }[] = [
  { id: "4:5", label: "Portrait 4:5" },
  { id: "1:1", label: "Square 1:1" },
  { id: "9:16", label: "Story 9:16" },
  { id: "16:9", label: "Wide 16:9" },
];

export function ImageStudio() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/studio/image" });
  const projectId = (search as any)?.projectId as string | undefined;

  const getProjectFn = useServerFn(getProject);
  const updateFn = useServerFn(updateProject);
  const genFn = useServerFn(generateProjectImage);
  const capFn = useServerFn(generateImageCaption);
  const listFn = useServerFn(listProjectImages);

  const [project, setProject] = useState<any>(null);
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<string>("photorealistic");
  const [aspect, setAspect] = useState<"1:1" | "4:5" | "9:16" | "16:9">("4:5");
  const [textOverlay, setTextOverlay] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [extra, setExtra] = useState("");

  const [images, setImages] = useState<any[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");

  useEffect(() => {
    if (!projectId) {
      toast.error("Missing project");
      navigate({ to: "/app" });
      return;
    }
    (async () => {
      try {
        const res: any = await getProjectFn({ data: { id: projectId } });
        setProject(res.project);
        const prefs = res.project.user_preferences ?? {};
        const saved = res.project.project_data ?? {};
        setConcept(saved.concept ?? prefs.angleConcept ?? prefs.angle ?? "");
        setStyle(saved.style ?? "photorealistic");
        setAspect(saved.aspect ?? "4:5");
        setTextOverlay(saved.textOverlay ?? "");
        setBrandColor(saved.brandColor ?? "");
        setCaption(saved.caption ?? "");
        setHashtags(saved.hashtags ?? []);

        const li: any = await listFn({ data: { projectId } });
        setImages(li.images ?? []);
        if (li.images?.[0]?.url) setActiveUrl(li.images[0].url);
      } catch (e: any) {
        toast.error(e?.message || "Couldn't load project");
      }
    })();
  }, [projectId, getProjectFn, listFn, navigate]);

  const aspectClass = useMemo(() => {
    switch (aspect) {
      case "1:1":
        return "aspect-square";
      case "9:16":
        return "aspect-[9/16]";
      case "16:9":
        return "aspect-video";
      default:
        return "aspect-[4/5]";
    }
  }, [aspect]);

  const generate = async (extraOverride?: string) => {
    if (!projectId) return;
    if (concept.trim().length < 5) {
      toast.error("Describe your image concept first");
      return;
    }
    setGenerating(true);
    setActiveUrl(null);
    try {
      const mergedExtra = extraOverride
        ? [extra, extraOverride].filter(Boolean).join(" — ")
        : extra;
      const res: any = await genFn({
        data: { projectId, concept, style: style as any, aspect, textOverlay, brandColor, extra: mergedExtra },
      });
      setActiveUrl(res.signedUrl);
      setImages((prev) => [res.asset, ...prev]);
      toast.success("Image ready");
      // Auto-generate caption alongside the first image
      if (!caption) regenerateCaption();
    } catch (e: any) {
      toast.error(e?.message || "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const regenerateCaption = async () => {
    if (!projectId || !concept) return;
    setCaptionLoading(true);
    try {
      const res: any = await capFn({ data: { projectId, concept } });
      setCaption(res.caption);
      setHashtags(res.hashtags);
    } catch (e: any) {
      toast.error(e?.message || "Caption generation failed");
    } finally {
      setCaptionLoading(false);
    }
  };

  const save = async () => {
    if (!projectId) return;
    try {
      await updateFn({
        data: {
          id: projectId,
          patch: {
            project_data: {
              concept,
              style,
              aspect,
              textOverlay,
              brandColor,
              caption,
              hashtags,
              activeUrl,
            } as any,
            status: activeUrl ? "complete" : "in_progress",
          },
        },
      });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/projects" })} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-bold tracking-tight gradient-text">Image Studio</h1>
          {project?.user_preferences?.angle && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              Angle: "{project.user_preferences.angle}"
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={save}>
          Save
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        {/* Left — controls */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-ig">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide">Image concept</Label>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe what should be in the image. E.g. 'A confident young woman drinking matcha at a sunlit cafe table, laptop open beside her, soft morning light.'"
              className="mt-1.5 min-h-[110px] text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide">Style</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                    style === s.id
                      ? "border-accent-primary bg-accent-primary/5"
                      : "border-border bg-card hover:border-strong"
                  }`}
                >
                  <span className="mr-1">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide">Aspect ratio</Label>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspect(a.id)}
                  className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                    aspect === a.id
                      ? "border-accent-primary bg-accent-primary/5"
                      : "border-border bg-card hover:border-strong"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Text overlay <span className="font-normal normal-case text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              placeholder='e.g. "5 Habits That Changed My Life"'
              className="mt-1.5 text-sm"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide">Brand color</Label>
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#FF5C8A"
                className="mt-1.5 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide">Extra direction</Label>
              <Input
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="optional vibe note"
                className="mt-1.5 text-sm"
              />
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={generating || concept.trim().length < 5}
            className="w-full gap-2"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Generate Image
              </>
            )}
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Powered by Nano Banana (Gemini 2.5 Flash Image). Takes ~10–20s.
          </p>
        </div>

        {/* Right — preview + caption */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-ig">
            <div className={`relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted ${aspectClass}`}>
              {activeUrl ? (
                <img src={activeUrl} alt="Generated post" className="h-full w-full object-cover" />
              ) : generating ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Crafting your image…</p>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm">Your image will appear here</p>
                </div>
              )}
            </div>

            {activeUrl && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={activeUrl} target="_blank" rel="noreferrer" download>
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRegenOpen((o) => !o)} disabled={generating}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPostOpen(true)}
                  disabled={!caption}
                  title={!caption ? "Generate a caption first" : ""}
                >
                  <Send className="h-3.5 w-3.5" /> Post to Instagram
                </Button>
              </div>
            )}

            {activeUrl && regenOpen && (
              <div className="mt-3 rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-3">
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  What should change? <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  value={regenPrompt}
                  onChange={(e) => setRegenPrompt(e.target.value)}
                  placeholder="e.g. 'warmer lighting', 'wider shot, more negative space', 'add a coffee cup on the table'"
                  className="mt-1.5 min-h-[70px] text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <EnhanceButton
                    value={regenPrompt}
                    onChange={setRegenPrompt}
                    kind="image"
                    context={`Concept: ${concept}\nStyle: ${style}\nAspect: ${aspect}`}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      await generate(regenPrompt.trim() || undefined);
                      setRegenOpen(false);
                      setRegenPrompt("");
                    }}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Regenerate now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRegenOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {images.length > 1 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Previous generations
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveUrl(img.url)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                        activeUrl === img.url ? "border-accent-primary" : "border-transparent"
                      }`}
                    >
                      <img src={img.url} alt="Variation" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-ig">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-accent-primary" /> Caption + hashtags
              </h3>
              <Button size="sm" variant="outline" onClick={regenerateCaption} disabled={captionLoading || !concept}>
                {captionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {caption ? "Regenerate" : "Generate"}
              </Button>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Your caption will appear here…"
              className="min-h-[140px] text-sm"
            />
            {hashtags.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  Hashtags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((h, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      #{h.replace(/^#/, "")}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
                    toast.success("Hashtags copied");
                  }}
                >
                  <Copy className="h-3 w-3" /> Copy hashtags
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PostScheduleModal
        open={postOpen}
        onOpenChange={setPostOpen}
        caption={caption}
        hashtags={hashtags}
        format="image"
      />
    </div>
  );
}