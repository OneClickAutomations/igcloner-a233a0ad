import { useState } from "react";
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
  RefreshCw,
  Wand2,
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
import { getProject } from "@/lib/projects.functions";
import { PostScheduleModal } from "@/components/PostScheduleModal";
import { Send } from "lucide-react";
import {
  generateReel,
  regenerateVeoPrompt,
  saveReel,
  type ReelDoc,
} from "@/lib/reel.functions";
import { submitVideoJob, pollVideoJob } from "@/lib/video.functions";

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

export function ReelStudio() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/studio/reel" });
  const projectId = (search as any)?.projectId as string | undefined;

  const getProjectFn = useServerFn(getProject);
  const genFn = useServerFn(generateReel);
  const saveFn = useServerFn(saveReel);
  const veoFn = useServerFn(regenerateVeoPrompt);
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

  async function handleGenerateVideo() {
    if (!doc?.veoPrompt) {
      toast.error("Generate the script first");
      return;
    }
    setVideoStatus("IN_QUEUE");
    setVideoUrl(null);
    setVideoError(null);
    setQueuePos(null);
    try {
      const { requestId, modelSlug, statusUrl, responseUrl }: any = await submitVideoFn({
        data: {
          prompt: doc.veoPrompt,
          model: videoModel,
          aspect_ratio: format,
          duration: videoDuration,
          generate_audio: videoAudio,
        },
      });
      toast.success("Video job queued. This usually takes 30–90s.");
      // Poll every 4s, up to ~5 minutes
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

  const project = useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const r = await getProjectFn({ data: { id: projectId! } });
      const p: any = (r as any).project;
      if (p?.project_data) setDoc(p.project_data as ReelDoc);
      // Pre-fill the angle textarea from the viral angle the user picked
      // (or the source post's DNA) so the field is never empty.
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
      return p;
    },
  });

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

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const r: any = await genFn({
        data: {
          projectId,
          angle: angle || undefined,
          settings: { format, duration, style, pace },
        },
      });
      setDoc(r.reel);
      toast.success("Reel generated");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!doc) return;
    try {
      await saveFn({ data: { projectId, reel: doc } });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
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

  const aiStudioUrl = "https://aistudio.google.com/";

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/projects" })}
          >
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
            </p>
          </div>
        </div>
        {doc && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" className="gap-1.5 gradient-accent text-white border-0 hover:opacity-95" onClick={() => setPostOpen(true)}>
              <Send className="h-3.5 w-3.5" /> Post Now
            </Button>
          </div>
        )}
      </div>

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
            {project.data.user_preferences?.angleConcept && (
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {project.data.user_preferences.angleConcept}
              </div>
            )}
            <div className="mt-1 text-[11px] text-muted-foreground">
              The source post's image, caption, and on-image text are sent to the AI as the reference for your script and VEO 3 prompt.
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr_1fr]">
        {/* LEFT: settings */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Settings
          </h2>

          <div>
            <Label className="text-xs">Angle / Topic (optional)</Label>
            <Textarea
              rows={3}
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="e.g. focus on morning routine for new dads"
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
              <Input
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="mt-1"
                placeholder="cinematic UGC"
              />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={busy} className="w-full">
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> {doc ? "Regenerate Script" : "Generate Script"}</>
            )}
          </Button>

          <div className="border-t border-border pt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <Badge className="bg-[#4285F4] hover:bg-[#4285F4] text-white">Google Gemini</Badge>
            <span>script</span>
            <span>•</span>
            <Badge className="bg-[#1A73E8] hover:bg-[#1A73E8] text-white">VEO 3</Badge>
            <span>video</span>
          </div>
        </div>

        {/* MIDDLE: script */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Script
          </h2>
          {!doc && (
            <p className="text-sm text-muted-foreground">
              Configure on the left and hit Generate. Gemini will produce a hook, scenes, caption, and the VEO 3 prompt.
            </p>
          )}
          {doc && (
            <div className="space-y-4">
              <div className="rounded-lg border border-strong bg-muted/40 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook</div>
                <div className="mt-1 font-semibold">{doc.hook.text}</div>
                <div className="mt-1 text-xs text-muted-foreground">🎬 {doc.hook.visualNote}</div>
              </div>

              {doc.scenes.map((s) => (
                <div key={s.index} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Scene {s.index}
                    </div>
                    <Badge variant="outline">{s.durationSec}s</Badge>
                  </div>
                  <div className="mt-1 text-sm">🗣 {s.voiceover}</div>
                  <div className="mt-1 text-xs text-muted-foreground">🎬 {s.visualNote}</div>
                  {s.onScreenText && (
                    <div className="mt-1 text-xs">📝 {s.onScreenText}</div>
                  )}
                </div>
              ))}

              <div className="rounded-lg border border-accent-primary/40 bg-accent-primary/5 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CTA</div>
                <div className="mt-1 font-medium">{doc.cta}</div>
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
                  {doc.hashtags.map((h) => (
                    <Badge key={h} variant="secondary" className="text-[10px]">
                      #{h}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    copy(
                      `${doc.caption}\n\n${doc.hashtags.map((h) => `#${h}`).join(" ")}`,
                      "Caption + hashtags copied",
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Caption
                </Button>
              </div>

              {doc.hookVariations.length > 0 && (
                <div>
                  <Label className="text-xs">Alternate hooks</Label>
                  <ul className="mt-1 space-y-1 text-sm">
                    {doc.hookVariations.map((h, i) => (
                      <li key={i} className="rounded border border-border p-2">
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: VEO 3 video generation */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Video Generation
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-foreground">Google VEO 3</span>
            </p>
          </div>

          {!doc?.veoPrompt && (
            <p className="text-sm text-muted-foreground">
              Your optimized VEO 3 prompt will appear here once the script is generated. Paste it into Google AI Studio to render your video.
            </p>
          )}

          {doc?.veoPrompt && (
            <>
              <div className="rounded-lg border border-strong bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {doc.veoPrompt}
              </div>

              {/* In-app video generation via fal.ai */}
              <div className="rounded-xl border-2 border-accent-primary/40 bg-accent-primary/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-accent-primary">
                      Generate video in-app
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Powered by fal.ai
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Beta</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Model</Label>
                    <Select value={videoModel} onValueChange={(v) => setVideoModel(v as any)}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veo3-fast">VEO 3 Fast (~$0.40/s)</SelectItem>
                        <SelectItem value="veo3">VEO 3 (~$0.75/s)</SelectItem>
                        <SelectItem value="kling-2.1">Kling 2.1 (~$0.10/s)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Length</Label>
                    <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(Number(v) as any)}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5s</SelectItem>
                        <SelectItem value="8">8s</SelectItem>
                        <SelectItem value="10">10s</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {videoModel !== "kling-2.1" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={videoAudio}
                      onChange={(e) => setVideoAudio(e.target.checked)}
                    />
                    Generate native audio (VEO 3)
                  </label>
                )}

                <Button
                  className="w-full gap-1.5 gradient-accent text-white border-0 hover:opacity-95"
                  onClick={handleGenerateVideo}
                  disabled={videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS"}
                >
                  {videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {videoStatus === "IN_QUEUE" ? `Queued${queuePos != null ? ` (#${queuePos})` : ""}…` : "Rendering video…"}</>
                  ) : (
                    <><Film className="h-4 w-4" /> {videoUrl ? "Regenerate Video" : "Generate Video"}</>
                  )}
                </Button>

                {(videoStatus === "IN_QUEUE" || videoStatus === "IN_PROGRESS") && (
                  <p className="text-[11px] text-muted-foreground">
                    Video models typically take 30–90 seconds. You can leave this tab open.
                  </p>
                )}

                {videoError && (
                  <p className="text-[11px] text-destructive">{videoError}</p>
                )}

                {videoUrl && (
                  <div className="space-y-2">
                    <video
                      src={videoUrl}
                      controls
                      playsInline
                      className="w-full rounded-lg border border-border bg-black"
                    />
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <a href={videoUrl} target="_blank" rel="noreferrer" download>
                        <ExternalLink className="h-3.5 w-3.5" /> Download / Open
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-2">
                Or render externally
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="default"
                  onClick={() => copy(doc.veoPrompt!, "VEO 3 prompt copied")}
                >
                  <Copy className="h-4 w-4" /> Copy VEO 3 Prompt
                </Button>
                <Button variant="outline" asChild>
                  <a href={aiStudioUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open Google AI Studio
                  </a>
                </Button>
              </div>

              <div className="rounded-lg border border-dashed border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
                ℹ Google AI Studio is free at{" "}
                <a
                  href={aiStudioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  aistudio.google.com
                </a>
                . Sign in with your Google account, open the VEO 3 model, and paste the prompt above.
              </div>

              <div className="border-t border-border pt-3">
                <Label className="text-xs">Refine the VEO 3 prompt</Label>
                <Textarea
                  rows={2}
                  value={veoInstruction}
                  onChange={(e) => setVeoInstruction(e.target.value)}
                  placeholder="e.g. more dramatic lighting, slower pan"
                  className="mt-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={handleVeoRegen}
                  disabled={veoBusy}
                >
                  {veoBusy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Rewriting…</>
                  ) : (
                    <><Wand2 className="h-4 w-4" /> Rewrite VEO 3 Prompt</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}