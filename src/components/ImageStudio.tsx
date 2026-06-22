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
  Check,
  ChevronRight,
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
import { EnhanceButton } from "@/components/EnhanceButton";
import { POST_GOALS, GOAL_LABEL, type PostGoal } from "@/lib/post-goals";
import {
  PLATFORM_LIST,
  PLATFORM_VOICE_PROFILES,
  type SocialPlatform,
} from "@/lib/platform-voice";
import {
  generatePlatformCopy,
  regeneratePlatformCopy,
  type PlatformCopyResult,
} from "@/lib/platform-copy.functions";
import { BrandingPanel } from "@/components/BrandingPanel";
import {
  DEFAULT_BRANDING,
  loadBranding,
  saveBranding,
  POSITION_STYLES,
  suggestBrandingPosition,
  type BrandingSettings,
} from "@/lib/branding";
import { MultiPlatformPostModal } from "@/components/MultiPlatformPostModal";

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
  const genPlatformFn = useServerFn(generatePlatformCopy);
  const regenPlatformFn = useServerFn(regeneratePlatformCopy);

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
  const [downloading, setDownloading] = useState(false);

  // A1 v2 — Goal, platforms, per-platform copy, branding
  const [goal, setGoal] = useState<PostGoal | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    "instagram",
  ]);
  const [platformCopy, setPlatformCopy] = useState<Record<string, PlatformCopyResult>>({});
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("instagram");
  const [platformLoading, setPlatformLoading] = useState<Record<string, boolean>>({});
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [showBrandingPanel, setShowBrandingPanel] = useState(false);

  const downloadActive = async () => {
    if (!activeUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(activeUrl);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "png").split(";")[0];
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `igcloner-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't download image");
    } finally {
      setDownloading(false);
    }
  };

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
        setGoal((saved.goal ?? prefs.goal ?? null) as PostGoal | null);
        const sp: SocialPlatform[] =
          Array.isArray(saved.selectedPlatforms) && saved.selectedPlatforms.length > 0
            ? saved.selectedPlatforms
            : Array.isArray(prefs.selectedPlatforms) && prefs.selectedPlatforms.length > 0
              ? prefs.selectedPlatforms
              : ["instagram"];
        setSelectedPlatforms(sp);
        setActivePlatform(sp[0] ?? "instagram");
        if (saved.platformCopy && typeof saved.platformCopy === "object") {
          setPlatformCopy(saved.platformCopy);
        }
        setBranding({ ...DEFAULT_BRANDING, ...loadBranding(projectId), ...(saved.branding ?? {}) });

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
              goal,
              selectedPlatforms,
              platformCopy,
              branding,
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

  // Persist branding to localStorage in addition to project record
  useEffect(() => {
    if (projectId) saveBranding(projectId, branding);
  }, [projectId, branding]);

  // Auto-suggest branding corner whenever text overlay placement could conflict.
  // (We only have a single text overlay knob — assume top-third placement.)
  useEffect(() => {
    if (!textOverlay) return;
    setBranding((b) => ({ ...b, position: suggestBrandingPosition("top") }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textOverlay ? "on" : "off"]);

  const togglePlatform = (p: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const generateAllPlatformCopy = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error("Pick at least one platform");
      return;
    }
    if (!goal) {
      toast.error("Pick a goal first");
      return;
    }
    const next: Record<string, boolean> = {};
    selectedPlatforms.forEach((p) => (next[p] = true));
    setPlatformLoading(next);
    try {
      const res: any = await genPlatformFn({
        data: {
          platforms: selectedPlatforms,
          goal,
          niche: (project?.user_preferences as any)?.niche,
          tone: (project?.user_preferences as any)?.toneOfVoice,
          angleHook: textOverlay || (project?.user_preferences as any)?.angle || "",
          angleConcept: concept,
          baseCaption: caption,
        },
      });
      const map: Record<string, PlatformCopyResult> = { ...platformCopy };
      for (const r of res.platforms as PlatformCopyResult[]) {
        map[r.platform] = r;
      }
      setPlatformCopy(map);
      setActivePlatform(selectedPlatforms[0]);
      setShowPlatformPicker(false);
      toast.success("Platform copy ready");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate platform copy");
    } finally {
      setPlatformLoading({});
    }
  };

  const regenerateOnePlatform = async (p: SocialPlatform) => {
    if (!goal) return;
    setPlatformLoading((s) => ({ ...s, [p]: true }));
    try {
      const res: any = await regenPlatformFn({
        data: {
          platform: p,
          goal,
          niche: (project?.user_preferences as any)?.niche,
          tone: (project?.user_preferences as any)?.toneOfVoice,
          angleHook: textOverlay || (project?.user_preferences as any)?.angle || "",
          angleConcept: concept,
          baseCaption: caption,
        },
      });
      setPlatformCopy((m) => ({ ...m, [p]: res as PlatformCopyResult }));
      toast.success(`${PLATFORM_VOICE_PROFILES[p].platform} copy regenerated`);
    } catch (e: any) {
      toast.error(e?.message || "Regeneration failed");
    } finally {
      setPlatformLoading((s) => ({ ...s, [p]: false }));
    }
  };

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(label);
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
          {goal && (
            <p className="text-[11px] text-accent-primary">Goal: {GOAL_LABEL[goal]}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={save}>
          Save
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        {/* Left — controls */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-ig">
          {/* GOAL SELECTOR — REQUIRED */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Post goal <span className="text-status-error">*</span>
            </Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Shapes captions, hooks, and CTAs to actually achieve it.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {POST_GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                      active
                        ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary"
                        : "border-border bg-card hover:border-strong"
                    }`}
                    title={g.description}
                  >
                    <span className="mr-1">{g.emoji}</span>
                    <span className="font-medium">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
            onClick={() => generate()}
            disabled={generating || concept.trim().length < 5 || !goal}
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
          {!goal && (
            <p className="text-[11px] text-status-error">Select a post goal first.</p>
          )}
          <p className="text-[11px] leading-snug text-muted-foreground">
            Powered by Nano Banana (Gemini 2.5 Flash Image). Takes ~10–20s.
          </p>

          {/* PLATFORMS button */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowPlatformPicker((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide">
                Platforms ({selectedPlatforms.length})
              </span>
              <ChevronRight
                className={`h-4 w-4 transition ${showPlatformPicker ? "rotate-90" : ""}`}
              />
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Same image everywhere — copy adapts to each platform's voice.
            </p>
            {showPlatformPicker && (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {PLATFORM_LIST.map((p) => {
                    const active = selectedPlatforms.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] transition ${
                          active
                            ? "border-accent-primary bg-accent-primary/10"
                            : "border-border bg-card hover:border-strong"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-current"
                          checked={active}
                          onChange={() => togglePlatform(p.key)}
                        />
                        <span aria-hidden>{p.icon}</span>
                        <span className="truncate">{p.platform}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => setSelectedPlatforms(PLATFORM_LIST.map((p) => p.key))}
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => setSelectedPlatforms([])}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="ml-auto h-7 gap-1 text-[11px]"
                    disabled={
                      selectedPlatforms.length === 0 ||
                      !goal ||
                      Object.values(platformLoading).some(Boolean)
                    }
                    onClick={generateAllPlatformCopy}
                  >
                    {Object.values(platformLoading).some(Boolean) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Generate copy
                  </Button>
                </div>
                <p className="rounded-md border border-dashed border-border bg-card px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                  🔜 Simultaneous auto-posting via Upload-Post API is coming soon. For now,
                  generate per-platform copy and copy/paste to each.
                </p>
              </div>
            )}
          </div>

          {/* BRANDING button */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowBrandingPanel((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide">
                Branding {branding.showHandle || branding.showLogo ? "· on" : "· off"}
              </span>
              <ChevronRight
                className={`h-4 w-4 transition ${showBrandingPanel ? "rotate-90" : ""}`}
              />
            </button>
            {showBrandingPanel && (
              <div className="mt-3">
                <BrandingPanel settings={branding} onChange={setBranding} />
                {textOverlay && (
                  <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-600">
                    ⚠ Text overlay is on. Position your branding away from it (default:
                    opposite corner).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — preview + caption */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-ig">
            <div className={`relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted ${aspectClass}`}>
              {activeUrl ? (
                <>
                  <img src={activeUrl} alt="Generated post" className="h-full w-full object-cover" />
                  {(branding.showHandle || (branding.showLogo && branding.logoUrl)) && (
                    <div
                      className="absolute z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-sm"
                      style={POSITION_STYLES[branding.position]}
                    >
                      {branding.showLogo && branding.logoUrl && (
                        <img
                          src={branding.logoUrl}
                          alt=""
                          className="h-4 w-4 rounded-sm object-cover"
                        />
                      )}
                      {branding.showHandle && (
                        <span className="text-[11px] font-semibold text-white">
                          {branding.handle}
                        </span>
                      )}
                    </div>
                  )}
                </>
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
                <Button size="sm" variant="outline" onClick={downloadActive} disabled={downloading}>
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Download
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRegenOpen((o) => !o)} disabled={generating}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPostOpen(true)}
                  disabled={selectedPlatforms.length === 0}
                >
                  <Send className="h-3.5 w-3.5" /> Post to {selectedPlatforms.length} platform
                  {selectedPlatforms.length === 1 ? "" : "s"}
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

          {/* Per-platform copy tabs (replaces single-caption block when platforms are picked) */}
          {selectedPlatforms.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-ig">
              <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border pb-2">
                {selectedPlatforms.map((p) => {
                  const profile = PLATFORM_VOICE_PROFILES[p];
                  const active = activePlatform === p;
                  const has = !!platformCopy[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActivePlatform(p)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                        active
                          ? "bg-accent-primary/10 text-accent-primary"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span aria-hidden>{profile.icon}</span>
                      <span>{profile.platform}</span>
                      {has && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1 text-[11px]"
                  onClick={generateAllPlatformCopy}
                  disabled={!goal || Object.values(platformLoading).some(Boolean)}
                >
                  {Object.values(platformLoading).some(Boolean) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Generate all
                </Button>
              </div>

              {(() => {
                const r = platformCopy[activePlatform];
                const profile = PLATFORM_VOICE_PROFILES[activePlatform];
                const loading = !!platformLoading[activePlatform];
                if (loading) {
                  return (
                    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating {profile.platform}{" "}
                      copy…
                    </div>
                  );
                }
                if (!r) {
                  return (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No {profile.platform}-specific copy yet.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 gap-1"
                        onClick={() => regenerateOnePlatform(activePlatform)}
                        disabled={!goal}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Generate for {profile.platform}
                      </Button>
                    </div>
                  );
                }
                const tagStr = r.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Hook
                      </p>
                      <p className="mt-1 text-sm font-medium leading-snug">{r.hook}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Post text · {r.characterCount} chars
                        {profile.characterLimit && ` / ${profile.characterLimit}`}
                      </p>
                      <Textarea
                        value={r.caption}
                        onChange={(e) =>
                          setPlatformCopy((m) => ({
                            ...m,
                            [activePlatform]: {
                              ...r,
                              caption: e.target.value,
                              characterCount: e.target.value.length,
                            },
                          }))
                        }
                        className="min-h-[140px] text-sm"
                      />
                    </div>
                    {r.hashtags.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Hashtags
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {r.hashtags.map((h, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              #{h.replace(/^#/, "")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.cta && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          CTA
                        </p>
                        <p className="mt-1 text-sm text-foreground/90">{r.cta}</p>
                      </div>
                    )}
                    {r.platformFitNotes && (
                      <p className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                        💡 {r.platformFitNotes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => regenerateOnePlatform(activePlatform)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Regenerate for {profile.platform}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          copyText(
                            `${r.caption}${tagStr ? `\n\n${tagStr}` : ""}`,
                            `${profile.platform} post copied`,
                          )
                        }
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy {profile.platform} post
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
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
          )}
        </div>
      </div>

      <MultiPlatformPostModal
        open={postOpen}
        onOpenChange={setPostOpen}
        platforms={selectedPlatforms}
        copyByPlatform={platformCopy}
        onDownloadImage={downloadActive}
        downloading={downloading}
      />
    </div>
  );
}