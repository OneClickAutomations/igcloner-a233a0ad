import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  "gradient", "solid-color", "blurred-bokeh", "urban-city", "nature-outdoor",
  "gym-fitness", "office-professional", "studio-clean", "abstract-dark", "text-overlay-only",
];
const MOOD_OPTIONS = ["warm", "cool", "neutral", "high-contrast", "monochromatic", "vibrant", "muted"];
const FORMAT_OPTIONS = [
  "text-on-screen-only", "text-with-background", "person-with-text-overlay",
  "b-roll-voiceover", "talking-head", "cinematic-no-person", "product-showcase",
];

type StepId = "direction" | "style" | "script" | "audio" | "video";
const STEPS: { id: StepId; label: string; icon: typeof Eye }[] = [
  { id: "direction", label: "Visual", icon: Eye },
  { id: "style",     label: "Style",  icon: Crown },
  { id: "script",    label: "Script", icon: Sparkles },
  { id: "audio",     label: "Audio",  icon: Sparkle },
  { id: "video",     label: "Render", icon: Film },
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
  const [step, setStep] = useState<StepId>("direction");
  const [confirmDel, setConfirmDel] = useState(false);

  const [direction, setDirection] = useState<VisualDirection | null>(null);
  const [editingDir, setEditingDir] = useState(false);

  const [stylePreset, setStylePreset] = useState<ReelStylePreset | undefined>(undefined);
  const [audioPlan, setAudioPlan] = useState<AudioPlan | undefined>(undefined);
  const [mixProfile, setMixProfile] = useState<AudioMixProfile>(DEFAULT_MIX);

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
          if (pd.visualDirection.approved) setStep(pd.hook ? "script" : "direction");
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
        ].filter(Boolean).join("\n\n");
        if (seeded) setAngle(seeded);
      }
      if (!(p?.project_data as any)?.visualDirection) {
        try {
          const d: any = await deriveFn({ data: { projectId: projectId! } });
          setDirection(d.visualDirection);
        } catch (e) { console.warn("derive direction failed", e); }
      }
      return p;
    },
  });

  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!projectId) return;
    const snapshot = JSON.stringify({ doc, direction });
    if (snapshot === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = snapshot;
      const patch: any = {};
      const audioBits = { stylePreset, audioPlan, mixProfile };
      if (doc) patch.project_data = { ...doc, visualDirection: direction ?? doc.visualDirection, ...audioBits };
      else if (direction) patch.project_data = { visualDirection: direction, ...audioBits };
      if (!patch.project_data) return;
      patch.status = doc?.hook ? "in_progress" : "draft";
      updateProjectFn({ data: { id: projectId, patch } }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [doc, direction, projectId, updateProjectFn, stylePreset, audioPlan, mixProfile]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!projectId || !direction) return;
      const patch: any = {
        project_data: { ...(doc ?? {}), visualDirection: direction },
        status: doc?.hook ? "in_progress" : "draft",
      };
      try { updateProjectFn({ data: { id: projectId, patch } }); } catch {}
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

  const stepCompletion: Record<StepId, boolean> = {
    direction: !!direction?.approved,
    style: !!stylePreset,
    script: !!doc?.hook,
    audio: !!audioPlan?.mode,
    video: !!videoUrl,
  };

  const handleApproveDirection = async () => {
    if (!direction) return;
    const approved = { ...direction, approved: true };
    setDirection(approved);
    try {
      await saveDirFn({ data: { projectId, visualDirection: approved } });
      toast.success("Visual direction locked in");
      setStep("style");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save direction");
    }
  };

  const handleGenerate = async () => {
    if (!direction?.approved) {
      toast.error("Approve the visual direction first");
      setStep("direction");
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
      toast.success("Script ready");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!doc) return;
    try {
      await saveFn({
        data: {
          projectId,
          reel: {
            ...doc,
            visualDirection: direction ?? doc.visualDirection,
            stylePreset, audioPlan, mixProfile,
          } as any,
        },
      });
      toast.success("Project saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  };

  const handleDelete = async () => {
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
      const r: any = await veoFn({ data: { projectId, instruction: veoInstruction || undefined } });
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
          prompt: full, model: videoModel, aspect_ratio: format,
          duration: videoDuration, generate_audio: videoAudio,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      });
      toast.success(imageUrl ? "Animating your source image — ~30-90s." : "Video job queued. ~30-90s.");
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

  const sourceThumb =
    doc?.sourceImageUrl ||
    (project.data as any)?.source_thumbnail ||
    (project.data as any)?.user_preferences?.referenceImageUrl ||
    null;

  const styleCfg = stylePreset ? REEL_STYLES.find((s) => s.id === stylePreset) : null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const prevStep = stepIndex > 0 ? STEPS[stepIndex - 1].id : null;
  const nextStep = stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1].id : null;

  // Primary CTA per step
  const primary = (() => {
    switch (step) {
      case "direction":
        return {
          label: direction?.approved ? "Continue" : "Approve direction",
          icon: direction?.approved ? ArrowRight : Check,
          disabled: !direction,
          onClick: direction?.approved ? () => setStep("style") : handleApproveDirection,
        };
      case "style":
        return {
          label: "Continue to script",
          icon: ArrowRight, disabled: false,
          onClick: () => setStep("script"),
        };
      case "script":
        return {
          label: busy ? "Writing…" : doc?.hook ? "Regenerate script" : "Generate script",
          icon: busy ? Loader2 : Sparkles, disabled: busy,
          onClick: handleGenerate, loading: busy,
        };
      case "audio":
        return {
          label: "Continue to render",
          icon: ArrowRight, disabled: !doc?.hook,
          onClick: () => setStep("video"),
        };
      case "video":
        return {
          label: videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS"
            ? (videoStatus === "IN_QUEUE" ? `Queued${queuePos != null ? ` (#${queuePos})` : ""}…` : "Rendering…")
            : "Generate video",
          icon: videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS" ? Loader2 : Film,
          disabled: !doc?.veoPrompt || videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS",
          loading: videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS",
          onClick: () => doc?.veoPrompt && handleGenerateVideo(doc.veoPrompt),
        };
    }
  })();

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/projects" })} className="shrink-0">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Projects</span>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
              {project.data?.title ?? "Reel project"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Video Production Studio
              {project.data?.source_account ? ` · @${project.data.source_account}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={!doc && !direction} className="hidden sm:inline-flex">
            Save
          </Button>
          {doc && (
            <Button variant="ghost" size="sm" className="hidden md:inline-flex"
              onClick={() => navigate({ to: "/studio/voiceover", search: { projectId: project.data!.id } })}>
              <Sparkles className="h-3.5 w-3.5" /> Voiceover
            </Button>
          )}
          {doc && (
            <Button size="sm" onClick={() => setPostOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Post</span>
            </Button>
          )}
          <Button
            variant="ghost" size="icon"
            onClick={() => setConfirmDel(true)}
            aria-label="Delete project"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-6 overflow-x-auto">
        <ol className="flex min-w-full items-center gap-1 rounded-xl border border-border bg-card p-1.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = stepCompletion[s.id] && !active;
            return (
              <li key={s.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-accent-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    active ? "bg-accent-primary text-white"
                    : done ? "bg-status-success/20 text-status-success"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
                  <span className="truncate font-medium">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* 3-panel layout */}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* LEFT — Context */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Source
            </div>
            {sourceThumb ? (
              <img
                src={`/api/public/img?u=${encodeURIComponent(sourceThumb)}`}
                alt="Source"
                className="mt-2 aspect-square w-full rounded-lg border border-border object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <div className="mt-2 aspect-square w-full rounded-lg border border-dashed border-border bg-muted/30 grid place-items-center text-xs text-muted-foreground">
                No source image
              </div>
            )}
            {project.data?.user_preferences?.angle && (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {project.data.user_preferences.angle}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Settings
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">{format}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Length</span>
              <span className="font-medium">{duration}s</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pace</span>
              <span className="font-medium capitalize">{pace}</span>
            </div>
            {styleCfg && (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Style</div>
                  <div className="truncate font-medium">{styleCfg.label}</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setStep("style")}>
                  Change
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER — Focus */}
        <section className="min-w-0">
          <div className="min-h-[400px] rounded-2xl border border-border bg-card p-5 lg:p-6">
            {step === "direction" && (
              <DirectionStep
                direction={direction}
                setDirection={setDirection}
                editingDir={editingDir}
                setEditingDir={setEditingDir}
              />
            )}
            {step === "style" && (
              <ReelStylePresets
                value={stylePreset}
                onChange={(id) => {
                  setStylePreset(id);
                  const cfg = REEL_STYLES.find((s) => s.id === id);
                  if (cfg) {
                    setPace(cfg.pace);
                    setAudioPlan((prev) => ({
                      ...(prev ?? {}),
                      mode: prev?.mode ?? cfg.defaultAudioMode,
                      musicGenre: prev?.musicGenre ?? cfg.defaultMusicGenre,
                      sfxIntensity: prev?.sfxIntensity ?? cfg.defaultSfx,
                      voiceCategory: prev?.voiceCategory ?? cfg.defaultVoiceCategory,
                      stylePreset: id,
                    }));
                    toast.success(`${cfg.label} style applied`);
                  }
                }}
              />
            )}
            {step === "script" && (
              <ScriptStep
                angle={angle} setAngle={setAngle}
                format={format} setFormat={setFormat}
                duration={duration} setDuration={setDuration}
                style={style} setStyle={setStyle}
                pace={pace} setPace={setPace}
              />
            )}
            {step === "audio" && (
              <AudioEngine
                projectId={projectId}
                imageUrl={sourceThumb || undefined}
                angle={angle}
                stylePreset={stylePreset}
                initialPlan={audioPlan}
                initialMix={mixProfile}
                onChange={(plan, mix) => { setAudioPlan(plan); setMixProfile(mix); }}
              />
            )}
            {step === "video" && (
              <VideoStep
                doc={doc}
                videoModel={videoModel} setVideoModel={setVideoModel}
                videoDuration={videoDuration} setVideoDuration={setVideoDuration}
                format={format} setFormat={setFormat}
                videoAudio={videoAudio} setVideoAudio={setVideoAudio}
                useSourceImage={useSourceImage} setUseSourceImage={setUseSourceImage}
                sourceThumb={sourceThumb}
                veoInstruction={veoInstruction} setVeoInstruction={setVeoInstruction}
                veoBusy={veoBusy} onVeoRegen={handleVeoRegen}
                onGenerate={handleGenerateVideo}
                videoStatus={videoStatus} videoUrl={videoUrl} videoError={videoError}
                onPost={() => setPostOpen(true)}
              />
            )}
          </div>

          {/* Sticky footer CTA */}
          <div className="sticky bottom-0 z-10 mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 backdrop-blur pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button
              variant="ghost" size="sm"
              onClick={() => prevStep && setStep(prevStep)}
              disabled={!prevStep}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {primary && (
              <Button
                onClick={primary.onClick}
                disabled={primary.disabled}
                size="lg"
                className="w-full gradient-accent text-white border-0"
              >
                {primary.loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <primary.icon className="h-4 w-4" />}
                {primary.label}
              </Button>
            )}
          </div>
        </section>

        {/* RIGHT — Output */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Script
            </div>
            {doc?.hook ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook</div>
                  <div className="mt-0.5 font-medium leading-snug">{doc.hook.text}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {doc.scenes?.length ?? 0} scene{(doc.scenes?.length ?? 0) === 1 ? "" : "s"}
                </div>
                {ctaObj?.text && (
                  <div className="rounded-lg border border-border p-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CTA</div>
                    <div className="mt-0.5 leading-snug">{ctaObj.text}</div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Script preview appears here once generated.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Final reel
            </div>
            {videoUrl ? (
              <video src={videoUrl} controls playsInline className="aspect-[9/16] w-full rounded-lg bg-black object-contain" />
            ) : (
              <div className="aspect-[9/16] w-full rounded-lg border border-dashed border-border bg-muted/30 grid place-items-center text-xs text-muted-foreground">
                Render output appears here
              </div>
            )}
            {videoUrl && (
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a href={videoUrl} target="_blank" rel="noreferrer" download>
                  <ExternalLink className="h-3.5 w-3.5" /> Download
                </a>
              </Button>
            )}
          </div>
        </aside>
      </div>

      {doc && (
        <PostScheduleModal
          open={postOpen}
          onOpenChange={setPostOpen}
          caption={doc.caption}
          hashtags={doc.hashtags}
          format="reel"
        />
      )}

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Step components ---------- */

function DirectionStep({
  direction, setDirection, editingDir, setEditingDir,
}: {
  direction: VisualDirection | null;
  setDirection: (d: VisualDirection) => void;
  editingDir: boolean;
  setEditingDir: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  if (!direction) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading source visual DNA…
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Visual direction</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Locks the look so the script and video stay on-brand.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Source DNA
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><span className="text-muted-foreground">Subject:</span> {direction.subjectDescription || direction.subjectType}</li>
            <li><span className="text-muted-foreground">Background:</span> {direction.backgroundDescription || direction.backgroundType}</li>
            <li><span className="text-muted-foreground">Lighting:</span> {direction.lightingStyle}</li>
            <li><span className="text-muted-foreground">Editing:</span> {direction.editingStyle}</li>
            <li><span className="text-muted-foreground">Pace:</span> {direction.paceAndEnergy}</li>
          </ul>
          {direction.colorPalette.approximateHex?.length > 0 && (
            <div className="mt-3 flex gap-1.5">
              {direction.colorPalette.approximateHex.map((h) => (
                <div key={h} className="h-7 w-7 rounded border border-border" style={{ background: h }} title={h} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Your video will look like
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditingDir((e) => !e)}>
              <Pencil className="h-3.5 w-3.5" /> {editingDir ? "Done" : "Customize"}
            </Button>
          </div>

          {!editingDir ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              <li><span className="text-muted-foreground">Subject:</span> {SUBJECT_OPTIONS.find((s) => s.v === direction.subjectType)?.l ?? direction.subjectType}</li>
              <li><span className="text-muted-foreground">Background:</span> {direction.backgroundDescription || direction.backgroundType}</li>
              <li><span className="text-muted-foreground">Color mood:</span> {direction.colorPalette.mood}</li>
              <li><span className="text-muted-foreground">Format:</span> {direction.contentFormat}</li>
              {direction.customNote && <li><span className="text-muted-foreground">Note:</span> {direction.customNote}</li>}
            </ul>
          ) : (
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
                  placeholder="Background detail"
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
                  <Label className="text-xs">Format</Label>
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
                  rows={2} className="mt-1"
                  value={direction.customNote}
                  onChange={(e) => setDirection({ ...direction, customNote: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptStep({
  angle, setAngle, format, setFormat, duration, setDuration,
  style, setStyle, pace, setPace,
}: any) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Script</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the brief, then generate. The script executes the approved visual direction.
        </p>
      </div>

      <div className="space-y-4">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Duration</Label>
            <Input type="number" min={8} max={60} value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 20)} className="mt-1" />
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
      </div>
    </div>
  );
}

function VideoStep({
  doc, videoModel, setVideoModel, videoDuration, setVideoDuration,
  format, setFormat, videoAudio, setVideoAudio,
  useSourceImage, setUseSourceImage, sourceThumb,
  veoInstruction, setVeoInstruction, veoBusy, onVeoRegen,
  onGenerate, videoStatus, videoUrl, videoError, onPost,
}: any) {
  if (!doc?.veoPrompt) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Generate a script first.
      </div>
    );
  }
  const models = [
    { id: "veo3-fast", name: "VEO 3 Fast", price: "~$0.40/s", note: "Recommended", icon: Zap, time: "~30s" },
    { id: "veo3", name: "VEO 3", price: "~$0.75/s", note: "Highest fidelity", icon: Crown, time: "~60–90s" },
    { id: "kling-2.1", name: "Kling 2.1", price: "~$0.10/s", note: "Cheapest, no audio", icon: Sparkle, time: "~45s" },
  ] as const;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Render</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick a model and generate. Stays on this page.</p>
      </div>

      {sourceThumb && (
        <div className="flex items-start gap-3 rounded-xl border border-border p-3">
          <img
            src={`/api/public/img?u=${encodeURIComponent(sourceThumb)}`}
            alt="Source"
            className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Source frame
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
              This image becomes the <span className="text-foreground">first frame</span> — the model animates it.
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={useSourceImage} onChange={(e) => setUseSourceImage(e.target.checked)} />
              Animate this image (recommended)
            </label>
          </div>
        </div>
      )}

      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Model</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {models.map((m) => {
            const Icon = m.icon;
            const selected = videoModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setVideoModel(m.id as any)}
                className={`text-left rounded-xl border p-3 transition ${
                  selected
                    ? "border-accent-primary/60 bg-accent-primary/8"
                    : "border-border bg-card hover:border-accent-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${selected ? "text-accent-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">{m.name}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{m.note} · {m.price} · {m.time}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Length</Label>
          <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(Number(v) as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5s</SelectItem>
              <SelectItem value="8">8s</SelectItem>
              <SelectItem value="10">10s</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Aspect</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="9:16">9:16</SelectItem>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="16:9">16:9</SelectItem>
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

      <div className="border-t border-border pt-4">
        <Label className="text-xs">Refine master prompt</Label>
        <Textarea
          rows={2}
          value={veoInstruction}
          onChange={(e) => setVeoInstruction(e.target.value)}
          placeholder="e.g. more dramatic lighting, slower pan"
          className="mt-1"
        />
        <Button size="sm" variant="outline" className="mt-2" onClick={onVeoRegen} disabled={veoBusy}>
          {veoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Rewrite prompt
        </Button>
      </div>

      {videoError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {videoError}
        </div>
      )}

      {videoUrl && (
        <div className="space-y-2 border-t border-border pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-status-success">
            ✓ Your video is ready
          </div>
          <video src={videoUrl} controls playsInline className="w-full rounded-lg border border-border bg-black" />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={videoUrl} target="_blank" rel="noreferrer" download>
                <ExternalLink className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={onPost}>
              <Send className="h-3.5 w-3.5" /> Post Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
