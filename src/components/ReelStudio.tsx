import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Copy,
  ExternalLink,
  ArrowLeft,
  Film,
  Wand2,
  Check,
  Pencil,
  Trash2,
  Send,
  Eye,
  ArrowRight,
  Zap,
  Crown,
  Sparkle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProject, updateProject, deleteProject } from "@/lib/projects.functions";
import { PostScheduleModal } from "@/components/PostScheduleModal";
import {
  generateReel,
  regenerateVeoPrompt,
  saveReel,
  deriveVisualDirection,
  saveVisualDirection,
  type ReelDoc,
  type VisualDirection,
} from "@/lib/reel.functions";
import { submitVideoJob, pollVideoJob } from "@/lib/video.functions";
import { ReelStylePresets } from "@/components/ReelStylePresets";
import { AudioEngine } from "@/components/AudioEngine";
import type { AudioPlan, AudioMixProfile, ReelStylePreset } from "@/lib/audio-types";
import { REEL_STYLES, DEFAULT_MIX } from "@/lib/audio-types";

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

const SUBJECT_OPTIONS = [
  { v: "text-graphic", l: "No people — text only" },
  { v: "person-lifestyle", l: "Person — lifestyle" },
  { v: "person-athlete", l: "Person — athletic" },
  { v: "person-business", l: "Person — business" },
  { v: "product", l: "Product showcase" },
  { v: "cinematic-no-person", l: "Cinematic — no person" },
  { v: "abstract", l: "Abstract / motion graphics" },
];
const BG_OPTIONS = [
  "gradient",
  "solid-color",
  "blurred-bokeh",
  "urban-city",
  "nature-outdoor",
  "gym-fitness",
  "office-professional",
  "studio-clean",
  "abstract-dark",
  "text-overlay-only",
];
const MOOD_OPTIONS = [
  "warm",
  "cool",
  "neutral",
  "high-contrast",
  "monochromatic",
  "vibrant",
  "muted",
];
const FORMAT_OPTIONS = [
  "text-on-screen-only",
  "text-with-background",
  "person-with-text-overlay",
  "b-roll-voiceover",
  "talking-head",
  "cinematic-no-person",
  "product-showcase",
];

export function ReelStudio() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/studio/reel" });
  const projectId = (search as any)?.projectId as string | undefined;

  const getProjectFn = useServerFn(getProject);
  const updateProjectFn = useServerFn(updateProject);
  const deleteProjectFn = useServerFn(deleteProject);
  const genFn = useServerFn(generateReel);
  const saveFn = useServerFn(saveReel);
  const veoFn = useServerFn(regenerateVeoPrompt);
  const deriveFn = useServerFn(deriveVisualDirection);
  const saveDirFn = useServerFn(saveVisualDirection);
  const submitVideoFn = useServerFn(submitVideoJob);
  const pollVideoFn = useServerFn(pollVideoJob);

  const [angle, setAngle] = useState("");
  const [duration, setDuration] = useState(20);
  const [format, setFormat] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [style, setStyle] = useState("cinematic UGC");
  const [pace, setPace] = useState<"fast" | "medium" | "slow">("fast");
  const [busy, setBusy] = useState(false);
  const [veoBusy, setVeoBusy] = useState(false);
  const [doc, setDoc] = useState<ReelDoc | null>(null);
  const [veoInstruction, setVeoInstruction] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const [tab, setTab] = useState<"direction" | "script" | "video">("direction");

  const [direction, setDirection] = useState<VisualDirection | null>(null);
  const [editingDir, setEditingDir] = useState(false);

  // Phase 1 — Style preset + Audio Engine
  const [stylePreset, setStylePreset] = useState<ReelStylePreset | undefined>(undefined);
  const [audioPlan, setAudioPlan] = useState<AudioPlan | undefined>(undefined);
  const [mixProfile, setMixProfile] = useState<AudioMixProfile>(DEFAULT_MIX);

  // In-app video generation state
  const [videoModel, setVideoModel] = useState<"veo3-fast" | "veo3" | "kling-2.1">("veo3-fast");
  const [videoDuration, setVideoDuration] = useState<5 | 8 | 10>(8);
  const [videoAudio, setVideoAudio] = useState(true);
  const [videoStatus, setVideoStatus] = useState<
    "idle" | "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
  >("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [queuePos, setQueuePos] = useState<number | null>(null);
  const [useSourceImage, setUseSourceImage] = useState(true);

  const project = useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const r = await getProjectFn({ data: { id: projectId! } });
      const p: any = (r as any).project;
      if (p?.project_data) {
        setDoc(p.project_data as ReelDoc);
        const pd = p.project_data as ReelDoc;
        if (pd.visualDirection) {
          setDirection(pd.visualDirection);
          if (pd.visualDirection.approved) setTab(pd.hook ? "script" : "direction");
        }
        if (pd.stylePreset) setStylePreset(pd.stylePreset);
        if (pd.audioPlan) setAudioPlan(pd.audioPlan);
        if (pd.mixProfile) setMixProfile(pd.mixProfile);
      }
      if (!angle) {
        const prefs = p?.user_preferences ?? {};
        const dna = p?.dna_analysis ?? {};
        const seeded = [
          prefs.angle,
          prefs.angleConcept,
          !prefs.angle && !prefs.angleConcept ? dna?.hookBreakdown?.whatWorks : null,
        ]
          .filter(Boolean)
          .join("\n\n");
        if (seeded) setAngle(seeded);
      }
      // If no direction yet, derive one from videoVisualDNA
      if (!(p?.project_data as any)?.visualDirection) {
        try {
          const d: any = await deriveFn({ data: { projectId: projectId! } });
          setDirection(d.visualDirection);
        } catch (e) {
          console.warn("derive direction failed", e);
        }
      }
      return p;
    },
  });

  // Auto-save draft on unload / unmount so users never lose work.
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!projectId) return;
    const snapshot = JSON.stringify({ doc, direction });
    if (snapshot === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = snapshot;
      const patch: any = {};
      if (doc) patch.project_data = { ...doc, visualDirection: direction ?? doc.visualDirection };
      else if (direction) patch.project_data = { visualDirection: direction };
      if (!patch.project_data) return;
      patch.status = doc?.hook ? "in_progress" : "draft";
      updateProjectFn({ data: { id: projectId, patch } }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [doc, direction, projectId, updateProjectFn]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!projectId || !direction) return;
      const patch: any = {
        project_data: { ...(doc ?? {}), visualDirection: direction },
        status: doc?.hook ? "in_progress" : "draft",
      };
      try {
        // Fire-and-forget; cannot await in beforeunload.
        updateProjectFn({ data: { id: projectId, patch } });
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [projectId, direction, doc, updateProjectFn]);

  if (!projectId) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-muted-foreground">Open this studio from a project.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/studio" })}>
          Back to Studio
        </Button>
      </div>
    );
  }

  const handleApproveDirection = async () => {
    if (!direction) return;
    const approved = { ...direction, approved: true };
    setDirection(approved);
    try {
      await saveDirFn({ data: { projectId, visualDirection: approved } });
      toast.success("Visual direction locked in");
      setTab("script");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save direction");
    }
  };

  const handleGenerate = async () => {
    if (!direction?.approved) {
      toast.error("Approve the visual direction first");
      setTab("direction");
      return;
    }
    setBusy(true);
    try {
      const r: any = await genFn({
        data: {
          projectId,
          angle: angle || undefined,
          settings: { format, duration, style, pace },
          visualDirection: direction,
        },
      });
      setDoc(r.reel);
      toast.success("Script ready — next: generate the video");
      setTab("video");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!doc) return;
    try {
      await saveFn({ data: { projectId, reel: { ...doc, visualDirection: direction ?? doc.visualDirection } } });
      toast.success("Project saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProjectFn({ data: { id: projectId } });
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const handleVeoRegen = async () => {
    setVeoBusy(true);
    try {
      const r: any = await veoFn({
        data: { projectId, instruction: veoInstruction || undefined },
      });
      setDoc((d) => (d ? { ...d, veoPrompt: r.veoPrompt } : d));
      toast.success("VEO 3 prompt updated");
    } catch (e: any) {
      toast.error(e?.message || "Regeneration failed");
    } finally {
      setVeoBusy(false);
    }
  };

  async function handleGenerateVideo(prompt: string, neg?: string) {
    setVideoStatus("IN_QUEUE");
    setVideoUrl(null);
    setVideoError(null);
    setQueuePos(null);
    try {
      const full = neg ? `${prompt}\n\nNegative prompt: ${neg}` : prompt;
      const imageUrl = useSourceImage
        ? (doc?.sourceImageUrl ||
            (project.data as any)?.source_thumbnail ||
            (project.data as any)?.user_preferences?.referenceImageUrl ||
            undefined)
        : undefined;
      const { requestId, modelSlug, statusUrl, responseUrl }: any = await submitVideoFn({
        data: {
          prompt: full,
          model: videoModel,
          aspect_ratio: format,
          duration: videoDuration,
          generate_audio: videoAudio,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      });
      toast.success(
        imageUrl
          ? "Animating your source image — ~30-90s."
          : "Video job queued. ~30-90s.",
      );
      const started = Date.now();
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 4000));
        const s: any = await pollVideoFn({ data: { requestId, modelSlug, statusUrl, responseUrl } });
        setVideoStatus(s.status);
        setQueuePos(s.queuePosition ?? null);
        if (s.status === "COMPLETED") {
          setVideoUrl(s.videoUrl);
          toast.success("Video ready");
          return;
        }
      }
      setVideoStatus("FAILED");
      setVideoError("Timed out waiting for the video. Try again.");
    } catch (e: any) {
      setVideoStatus("FAILED");
      setVideoError(e?.message || "Generation failed");
      toast.error(e?.message || "Generation failed");
    }
  }

  const ctaObj =
    doc && typeof doc.cta === "string"
      ? { text: doc.cta as string, visualNote: "", onScreenText: doc.cta as string }
      : (doc?.cta as any);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/projects" })}>
            <ArrowLeft className="h-4 w-4" /> Projects
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Film className="h-5 w-5 text-accent-primary" />
              Video Production Studio
              {project.data?.user_preferences?.cloneMode && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  {project.data.user_preferences.cloneMode === "inspired" ? "Inspired" : "Exact Duplicate"}
                </Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {project.data?.title ?? "Reel project"}
              {project.data?.source_account ? ` — @${project.data.source_account}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={!doc && !direction}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-status-error hover:text-status-error">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          {doc && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate({ to: "/studio/voiceover", search: { projectId: project.data!.id } })
              }
            >
              <Sparkles className="h-3.5 w-3.5" /> Voiceover
            </Button>
          )}
          {doc && (
            <Button
              size="sm"
              className="gap-1.5 gradient-accent text-white border-0 hover:opacity-95"
              onClick={() => setPostOpen(true)}
            >
              <Send className="h-3.5 w-3.5" /> Post Now
            </Button>
          )}
        </div>
      </div>

      {/* Source brief */}
      {project.data && (project.data.source_thumbnail || project.data.user_preferences?.angle) && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-3">
          {project.data.source_thumbnail && (
            <img
              src={`/api/public/img?u=${encodeURIComponent(project.data.source_thumbnail)}`}
              alt="Source post"
              className="h-16 w-16 shrink-0 rounded-lg object-cover border border-border"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-accent-primary">
              Cloning from {project.data.source_account ? `@${project.data.source_account}` : "source post"}
            </div>
            {project.data.user_preferences?.angle && (
              <div className="mt-0.5 text-sm font-medium line-clamp-2">
                {project.data.user_preferences.angle}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground">
              The source post's visual DNA, image, and on-image text are the brief for your video.
            </div>
          </div>
        </div>
      )}

      {doc && (
        <PostScheduleModal
          open={postOpen}
          onOpenChange={setPostOpen}
          caption={doc.caption}
          hashtags={doc.hashtags}
          format="reel"
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="direction" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> 1. Visual Direction
            {direction?.approved && <Check className="h-3 w-3 text-status-success" />}
          </TabsTrigger>
          <TabsTrigger value="script" disabled={!direction?.approved} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> 2. Script
            {doc?.hook && <Check className="h-3 w-3 text-status-success" />}
          </TabsTrigger>
          <TabsTrigger value="video" disabled={!doc?.hook} className="gap-1.5">
            <Film className="h-3.5 w-3.5" /> 3. Generate Video
          </TabsTrigger>
        </TabsList>

        {/* TAB 1 — VISUAL DIRECTION */}
        <TabsContent value="direction" className="mt-4">
          {!direction ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading source visual DNA…
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Source DNA snapshot */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  What the source looks like
                </div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li><strong>Subject:</strong> {direction.subjectDescription || direction.subjectType}</li>
                  <li><strong>Background:</strong> {direction.backgroundDescription || direction.backgroundType}</li>
                  <li><strong>Lighting:</strong> {direction.lightingStyle}</li>
                  <li><strong>Editing:</strong> {direction.editingStyle}</li>
                  <li><strong>Pace:</strong> {direction.paceAndEnergy}</li>
                  <li><strong>Audio:</strong> {direction.audioStyle}</li>
                  <li><strong>Production:</strong> {direction.productionLevel}</li>
                </ul>
                {direction.colorPalette.approximateHex?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Color palette</div>
                    <div className="mt-1 flex gap-1.5">
                      {direction.colorPalette.approximateHex.map((h) => (
                        <div key={h} className="flex flex-col items-center gap-0.5">
                          <div className="h-8 w-8 rounded border border-border" style={{ background: h }} />
                          <div className="text-[9px] font-mono text-muted-foreground">{h}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {direction.platformAesthetic && (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs italic text-muted-foreground">
                    "{direction.platformAesthetic}"
                  </div>
                )}
              </div>

              {/* Approve / customize */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Your video will look like
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingDir((e) => !e)}>
                    <Pencil className="h-3.5 w-3.5" /> {editingDir ? "Done" : "Customize"}
                  </Button>
                </div>

                {!editingDir && (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    <li><strong>Subject:</strong> {SUBJECT_OPTIONS.find((s) => s.v === direction.subjectType)?.l ?? direction.subjectType}</li>
                    <li><strong>Background:</strong> {direction.backgroundDescription || direction.backgroundType}</li>
                    <li><strong>Color mood:</strong> {direction.colorPalette.mood}</li>
                    <li><strong>Content format:</strong> {direction.contentFormat}</li>
                    {direction.customNote && <li><strong>Your note:</strong> {direction.customNote}</li>}
                  </ul>
                )}

                {editingDir && (
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <Label className="text-xs">Subject type</Label>
                      <Select value={direction.subjectType} onValueChange={(v) => setDirection({ ...direction, subjectType: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUBJECT_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Background</Label>
                      <Select value={direction.backgroundType} onValueChange={(v) => setDirection({ ...direction, backgroundType: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BG_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        className="mt-2"
                        value={direction.backgroundDescription}
                        onChange={(e) => setDirection({ ...direction, backgroundDescription: e.target.value })}
                        placeholder="Background detail (e.g. deep navy gradient with grain)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Color mood</Label>
                        <Select
                          value={direction.colorPalette.mood}
                          onValueChange={(v) => setDirection({ ...direction, colorPalette: { ...direction.colorPalette, mood: v } })}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MOOD_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Content format</Label>
                        <Select value={direction.contentFormat} onValueChange={(v) => setDirection({ ...direction, contentFormat: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FORMAT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Additional direction</Label>
                      <Textarea
                        rows={2}
                        className="mt-1"
                        value={direction.customNote}
                        onChange={(e) => setDirection({ ...direction, customNote: e.target.value })}
                        placeholder="Any specific visual elements you want…"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleApproveDirection}
                    size="lg"
                    className="flex-1 gap-1.5 gradient-accent text-white border-0 hover:opacity-95"
                  >
                    {direction.approved ? <Check className="h-4 w-4" /> : null}
                    Next: Write Script
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground text-center">
                  Step 1 of 3 — locks the look so the script and video stay on-brand.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2 — SCRIPT */}
        <TabsContent value="script" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Settings</h2>
              <div>
                <Label className="text-xs">Angle / Topic (optional)</Label>
                <Textarea
                  rows={3}
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  placeholder="e.g. compound interest needs your youth"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16">9:16 vertical</SelectItem>
                      <SelectItem value="1:1">1:1 square</SelectItem>
                      <SelectItem value="16:9">16:9 horizontal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duration (s)</Label>
                  <Input
                    type="number"
                    min={8}
                    max={60}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 20)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Pace</Label>
                  <Select value={pace} onValueChange={(v) => setPace(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="slow">Slow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Style</Label>
                  <Input value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1" />
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={busy}
                size="lg"
                className="w-full gradient-accent text-white border-0 hover:opacity-95"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Writing your script…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> {doc?.hook ? "Regenerate Script" : "Generate Script"}</>
                )}
              </Button>
              {doc?.hook && (
                <Button
                  onClick={() => setTab("video")}
                  size="lg"
                  variant="outline"
                  className="w-full gap-1.5 border-2 border-accent-primary text-accent-primary hover:bg-accent-primary/5"
                >
                  Next: Generate Video <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Script</h2>
              {!doc?.hook && (
                <p className="text-sm text-muted-foreground">
                  Configure on the left and hit Generate. The script will execute the approved visual direction exactly.
                </p>
              )}
              {doc?.hook && (
                <div className="space-y-4">
                  {doc.visualSummary && (
                    <div className="rounded-lg border border-dashed border-border p-3 text-xs italic text-muted-foreground">
                      Visual summary: {doc.visualSummary}
                    </div>
                  )}
                  <div className="rounded-lg border border-strong bg-muted/40 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook (0–3s)</div>
                    <div className="mt-1 font-semibold">{doc.hook.text}</div>
                    {doc.hook.onScreenText && <div className="mt-1 text-sm">📝 {doc.hook.onScreenText}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">🎬 {doc.hook.visualNote}</div>
                    {doc.hook.animationNote && <div className="text-[11px] text-muted-foreground">✨ {doc.hook.animationNote}</div>}
                  </div>
                  {doc.scenes.map((s) => (
                    <div key={s.index} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Scene {s.index}</div>
                        <Badge variant="outline">{s.durationSec}s</Badge>
                      </div>
                      {s.voiceover && <div className="mt-1 text-sm">🗣 {s.voiceover}</div>}
                      {s.onScreenText && <div className="mt-1 text-sm">📝 {s.onScreenText}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">🎬 {s.visualNote}</div>
                      {s.animationNote && <div className="text-[11px] text-muted-foreground">✨ {s.animationNote}</div>}
                    </div>
                  ))}
                  <div className="rounded-lg border border-accent-primary/40 bg-accent-primary/5 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CTA</div>
                    <div className="mt-1 font-medium">{ctaObj?.text}</div>
                    {ctaObj?.onScreenText && <div className="text-sm">📝 {ctaObj.onScreenText}</div>}
                  </div>

                  <div>
                    <Label className="text-xs">Caption</Label>
                    <Textarea
                      rows={5}
                      value={doc.caption}
                      onChange={(e) => setDoc({ ...doc, caption: e.target.value })}
                      className="mt-1"
                    />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {doc.hashtags.map((h: string) => (
                        <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => copy(`${doc.caption}\n\n${doc.hashtags.map((h: string) => `#${h}`).join(" ")}`, "Caption + hashtags copied")}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Caption
                    </Button>
                  </div>

                  {doc.hookVariations?.length > 0 && (
                    <div>
                      <Label className="text-xs">Alternate hooks</Label>
                      <ul className="mt-1 space-y-1 text-sm">
                        {doc.hookVariations.map((h: string, i: number) => (
                          <li key={i} className="rounded border border-border p-2">{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {doc.directorNotes && (
                    <div className="rounded-lg border border-dashed border-border p-3 text-xs">
                      <strong>Director's notes:</strong> {doc.directorNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 3 — GENERATE VIDEO */}
        <TabsContent value="video" className="mt-4">
          {!doc?.veoPrompt && (
            <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
              Generate a script first.
            </div>
          )}
          {doc?.veoPrompt && (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              {/* Prompts column */}
              <div className="space-y-4 rounded-2xl border border-border bg-card p-5 order-2 lg:order-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prompt package</h2>
                  <Badge variant="secondary">Auto-generated</Badge>
                </div>

                {doc.veoPrompts?.styleConsistencyNotes && (
                  <div className="rounded-lg border border-dashed border-border p-3 text-xs">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Visual consistency brief</div>
                    <div className="mt-1">{doc.veoPrompts.styleConsistencyNotes}</div>
                  </div>
                )}

                {/* Master prompt fallback */}
                <PromptBlock
                  label="Master prompt"
                  prompt={doc.veoPrompt}
                  onGen={() => handleGenerateVideo(doc.veoPrompt!)}
                />

                {doc.veoPrompts?.hookPrompt && (
                  <PromptBlock
                    label={`Hook (${doc.veoPrompts.hookPrompt.duration})`}
                    prompt={doc.veoPrompts.hookPrompt.prompt}
                    negative={doc.veoPrompts.hookPrompt.negativePrompt}
                    onGen={() => handleGenerateVideo(doc.veoPrompts!.hookPrompt.prompt, doc.veoPrompts!.hookPrompt.negativePrompt)}
                  />
                )}
                {doc.veoPrompts?.scenePrompts?.map((p) => (
                  <PromptBlock
                    key={p.sceneNumber}
                    label={`Scene ${p.sceneNumber} (${p.duration})`}
                    prompt={p.prompt}
                    negative={p.negativePrompt}
                    onGen={() => handleGenerateVideo(p.prompt, p.negativePrompt)}
                  />
                ))}
                {doc.veoPrompts?.ctaPrompt && (
                  <PromptBlock
                    label={`CTA (${doc.veoPrompts.ctaPrompt.duration})`}
                    prompt={doc.veoPrompts.ctaPrompt.prompt}
                    negative={doc.veoPrompts.ctaPrompt.negativePrompt}
                    onGen={() => handleGenerateVideo(doc.veoPrompts!.ctaPrompt.prompt, doc.veoPrompts!.ctaPrompt.negativePrompt)}
                  />
                )}

                {/* Refine */}
                <div className="border-t border-border pt-3">
                  <Label className="text-xs">Refine master prompt</Label>
                  <Textarea
                    rows={2}
                    value={veoInstruction}
                    onChange={(e) => setVeoInstruction(e.target.value)}
                    placeholder="e.g. more dramatic lighting, slower pan"
                    className="mt-1"
                  />
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={handleVeoRegen} disabled={veoBusy}>
                    {veoBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Rewriting…</> : <><Wand2 className="h-4 w-4" /> Rewrite Master Prompt</>}
                  </Button>
                </div>
              </div>

              {/* Generate column */}
              <div className="space-y-4 rounded-2xl border-2 border-accent-primary/50 bg-accent-primary/5 p-5 order-1 lg:order-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-accent-primary">Step 3 of 3 — Generate</div>
                  <h3 className="text-lg font-bold tracking-tight">Pick a model and render</h3>
                  <p className="text-xs text-muted-foreground">Generates inside the app. No other tools needed.</p>
                </div>

                {/* Source image anchor */}
                {(doc.sourceImageUrl || (project.data as any)?.source_thumbnail) && (
                  <div className="rounded-xl border-2 border-accent-primary/40 bg-card p-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={`/api/public/img?u=${encodeURIComponent(
                          doc.sourceImageUrl ||
                            (project.data as any)?.source_thumbnail,
                        )}`}
                        alt="Source frame"
                        className="h-20 w-20 shrink-0 rounded-lg object-cover border border-border"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).style.display = "none")
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-accent-primary">
                          Source frame
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                          This image will be the <strong>first frame</strong> and visual
                          anchor. The model animates it instead of generating a new scene.
                        </p>
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={useSourceImage}
                            onChange={(e) => setUseSourceImage(e.target.checked)}
                          />
                          Animate this image (recommended)
                        </label>
                        {doc.motionStrategy && useSourceImage && (
                          <div className="mt-2 grid gap-1 text-[10px] text-muted-foreground">
                            <div>
                              <strong className="text-foreground">Camera:</strong>{" "}
                              {doc.motionStrategy.cameraMotion}
                            </div>
                            <div>
                              <strong className="text-foreground">Environment:</strong>{" "}
                              {doc.motionStrategy.environmentalMotion}
                            </div>
                            <div>
                              <strong className="text-foreground">Subject:</strong>{" "}
                              {doc.motionStrategy.subjectMotion}
                            </div>
                            <div>
                              <strong className="text-foreground">Confidence:</strong>{" "}
                              {doc.motionStrategy.confidence} · preserves ≥
                              {doc.motionStrategy.preservationTargetPct}% of the image
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Model cards */}
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">1. Choose model</Label>
                  <div className="mt-2 grid gap-2">
                    {[
                      { id: "veo3-fast" as const, name: "VEO 3 Fast", price: "~$0.40/s", note: "Best balance — recommended", icon: Zap, time: "~30s" },
                      { id: "veo3" as const, name: "VEO 3", price: "~$0.75/s", note: "Highest fidelity, native audio", icon: Crown, time: "~60–90s" },
                      { id: "kling-2.1" as const, name: "Kling 2.1", price: "~$0.10/s", note: "Cheapest, no audio", icon: Sparkle, time: "~45s" },
                    ].map((m) => {
                      const Icon = m.icon;
                      const selected = videoModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setVideoModel(m.id)}
                          className={`text-left rounded-xl border-2 p-3 transition ${
                            selected
                              ? "border-accent-primary bg-accent-primary/10"
                              : "border-border bg-card hover:border-accent-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${selected ? "text-accent-primary" : "text-muted-foreground"}`} />
                            <span className="font-semibold text-sm">{m.name}</span>
                            <Badge variant="outline" className="ml-auto text-[10px]">{m.price}</Badge>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{m.note} • {m.time}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">2. Length</Label>
                    <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(Number(v) as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="8">8 seconds</SelectItem>
                        <SelectItem value="10">10 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Aspect</Label>
                    <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9:16">9:16 Vertical</SelectItem>
                        <SelectItem value="1:1">1:1 Square</SelectItem>
                        <SelectItem value="16:9">16:9 Wide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {videoModel !== "kling-2.1" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={videoAudio} onChange={(e) => setVideoAudio(e.target.checked)} />
                    Generate native audio
                  </label>
                )}

                <Button
                  size="lg"
                  className="w-full gradient-accent text-white border-0 hover:opacity-95 text-base font-semibold"
                  disabled={videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS"}
                  onClick={() => handleGenerateVideo(doc.veoPrompt!)}
                >
                  {videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {videoStatus === "IN_QUEUE" ? `Queued${queuePos != null ? ` (#${queuePos})` : ""}…` : "Rendering…"}
                    </>
                  ) : (
                    <><Film className="h-5 w-5" /> Generate Video Now</>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  Usually ready in 30–90 seconds. Stays on this page while it renders.
                </p>

                {videoError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    {videoError}
                  </div>
                )}

                {videoUrl && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-status-success">✓ Your video is ready</div>
                    <video src={videoUrl} controls playsInline className="w-full rounded-lg border border-border bg-black" />
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={videoUrl} target="_blank" rel="noreferrer" download>
                          <ExternalLink className="h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPostOpen(true)}>
                        <Send className="h-3.5 w-3.5" /> Post Now
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PromptBlock({
  label,
  prompt,
  negative,
  onGen,
}: {
  label: string;
  prompt: string;
  negative?: string;
  onGen?: () => void;
}) {
  return (
    <div className="rounded-lg border border-strong bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => copy(prompt, "Prompt copied")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {onGen && (
            <Button size="sm" variant="outline" onClick={onGen} className="gap-1">
              <Film className="h-3.5 w-3.5" /> Render
            </Button>
          )}
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{prompt}</div>
      {negative && (
        <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
          <strong>Negative:</strong> {negative}
        </div>
      )}
    </div>
  );
}
