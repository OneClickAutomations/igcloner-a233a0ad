import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Mic,
  Play,
  Sparkles,
  Trash2,
  Wand2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProject } from "@/lib/projects.functions";
import {
  VOICE_CATALOG,
  type VoicePreset,
  type VoiceCategory,
} from "@/lib/voiceover.functions";
import {
  previewVoice,
  generateSceneVoiceover,
  listSceneVoiceovers,
  deleteVoiceover,
} from "@/lib/voiceover.functions";

const CATEGORIES: { v: VoiceCategory | "all"; l: string }[] = [
  { v: "all", l: "All" },
  { v: "narration", l: "Narration" },
  { v: "conversational", l: "Conversational" },
  { v: "energetic", l: "Energetic" },
  { v: "calm", l: "Calm" },
  { v: "warm", l: "Warm" },
  { v: "news", l: "News" },
  { v: "trailer", l: "Trailer" },
  { v: "character", l: "Character" },
  { v: "social", l: "Social-ready" },
];

function VoiceCard({
  voice,
  selected,
  onSelect,
  onPreview,
  previewLoading,
}: {
  voice: VoicePreset;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition ${
        selected
          ? "border-primary bg-primary/5 shadow-ig"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{voice.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {voice.gender} · {voice.accent}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          disabled={previewLoading}
        >
          {previewLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{voice.description}</p>
      <div className="flex flex-wrap gap-1">
        {voice.categories.slice(0, 3).map((c) => (
          <Badge key={c} variant="secondary" className="text-[10px]">
            {c}
          </Badge>
        ))}
      </div>
    </button>
  );
}

export function VoiceoverStudio() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/studio/voiceover" }) as {
    projectId?: string;
  };
  const projectId = search.projectId;

  const getProjectFn = useServerFn(getProject);
  const listFn = useServerFn(listSceneVoiceovers);
  const previewFn = useServerFn(previewVoice);
  const genFn = useServerFn(generateSceneVoiceover);
  const delFn = useServerFn(deleteVoiceover);

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId! } }),
    enabled: !!projectId,
  });

  const assetsQ = useQuery({
    queryKey: ["voiceovers", projectId],
    queryFn: () => listFn({ data: { projectId: projectId! } }),
    enabled: !!projectId,
  });

  const reel = (projectQ.data?.project?.project_data as any) ?? null;
  const scenes: Array<{
    index: number;
    voiceover: string;
    onScreenText: string;
    durationSec: number;
  }> = useMemo(() => {
    if (!reel?.scenes) return [];
    const items: any[] = [
      ...(reel.hook
        ? [{ index: 0, voiceover: reel.hook.text || reel.hook.onScreenText || "", onScreenText: reel.hook.onScreenText || "", durationSec: 3 }]
        : []),
      ...reel.scenes.map((s: any) => ({
        index: s.index,
        voiceover: s.voiceover || s.onScreenText || "",
        onScreenText: s.onScreenText || "",
        durationSec: s.durationSec || 3,
      })),
    ];
    return items;
  }, [reel]);

  /* ---------- selection + settings ---------- */
  const [category, setCategory] = useState<VoiceCategory | "all">("all");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(
    VOICE_CATALOG[0].id,
  );
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0.3);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [emotion, setEmotion] = useState<string>("neutral");

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ---------- per-scene state ---------- */
  const [sceneText, setSceneText] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    if (!scenes.length) return;
    setSceneText((prev) => {
      const next = { ...prev };
      for (const s of scenes) if (next[s.index] === undefined) next[s.index] = s.voiceover;
      return next;
    });
  }, [scenes]);

  const filteredVoices = useMemo(
    () =>
      category === "all"
        ? VOICE_CATALOG
        : VOICE_CATALOG.filter((v) => v.categories.includes(category)),
    [category],
  );

  const settings = {
    stability,
    similarity_boost: similarity,
    style,
    use_speaker_boost: speakerBoost,
    speed,
  };

  // map sceneIndex → asset
  const assetByScene = useMemo(() => {
    const map = new Map<number, any>();
    for (const a of assetsQ.data?.assets ?? []) {
      const idx = a?.metadata?.sceneIndex;
      if (typeof idx === "number" && !map.has(idx)) map.set(idx, a);
    }
    return map;
  }, [assetsQ.data]);

  async function playUrl(url: string) {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Playback failed");
    }
  }

  async function handlePreview(voiceId: string) {
    try {
      setPreviewingId(voiceId);
      const sampleText =
        emotion === "excited"
          ? "Wait — you HAVE to see this. This changes everything."
          : emotion === "calm"
          ? "Take a breath. Here's something worth slowing down for."
          : "Hey! This is what I sound like for your next reel.";
      const { audioDataUrl } = await previewFn({
        data: { voiceId, text: sampleText, settings },
      });
      await playUrl(audioDataUrl);
    } catch (e: any) {
      toast.error(e?.message ?? "Preview failed");
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleGenerateScene(sceneIndex: number) {
    if (!projectId) return;
    const text = (sceneText[sceneIndex] ?? "").trim();
    if (!text) {
      toast.error("Add voiceover text for this scene first.");
      return;
    }
    try {
      setGenerating(sceneIndex);
      await genFn({
        data: {
          projectId,
          sceneIndex,
          text,
          voiceId: selectedVoiceId,
          settings,
        },
      });
      toast.success(`Scene ${sceneIndex} voiceover ready`);
      await assetsQ.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setGenerating(null);
    }
  }

  async function handleGenerateAll() {
    if (!projectId) return;
    try {
      setGeneratingAll(true);
      for (const s of scenes) {
        const text = (sceneText[s.index] ?? "").trim();
        if (!text) continue;
        await genFn({
          data: {
            projectId,
            sceneIndex: s.index,
            text,
            voiceId: selectedVoiceId,
            settings,
          },
        });
      }
      toast.success("All voiceovers generated");
      await assetsQ.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Batch generation failed");
    } finally {
      setGeneratingAll(false);
    }
  }

  async function handleDelete(assetId: string) {
    try {
      await delFn({ data: { assetId } });
      toast.success("Removed");
      await assetsQ.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  if (!projectId) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-muted-foreground">
          Open a reel project to generate voiceover.
        </p>
        <Button className="mt-4" onClick={() => navigate({ to: "/projects" })}>
          Go to Projects
        </Button>
      </div>
    );
  }

  if (projectQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate({
                to: "/studio/reel",
                search: { projectId },
              })
            }
          >
            <ArrowLeft className="h-4 w-4" /> Back to reel
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Voiceover Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate studio-grade voiceover per scene with ElevenLabs.
          </p>
        </div>
        <Button
          onClick={handleGenerateAll}
          disabled={generatingAll || !scenes.length}
          className="gradient-accent text-white"
        >
          {generatingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate all
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        {/* ---------- Voice catalog + settings ---------- */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Voice library</h3>
            <div className="mb-3 flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.v}
                  onClick={() => setCategory(c.v)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                    category === c.v
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {filteredVoices.map((v) => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  selected={selectedVoiceId === v.id}
                  onSelect={() => setSelectedVoiceId(v.id)}
                  onPreview={() => handlePreview(v.id)}
                  previewLoading={previewingId === v.id}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Delivery</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Emotional tone</Label>
                <Select value={emotion} onValueChange={setEmotion}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="excited">Excited</SelectItem>
                    <SelectItem value="calm">Calm</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <SliderRow
                label="Stability"
                hint="Lower = more expressive · higher = consistent"
                value={stability}
                onChange={setStability}
              />
              <SliderRow
                label="Clarity / Similarity"
                hint="How closely to match the source voice"
                value={similarity}
                onChange={setSimilarity}
              />
              <SliderRow
                label="Style exaggeration"
                hint="Higher = more stylized delivery"
                value={style}
                onChange={setStyle}
              />
              <SliderRow
                label="Speed"
                hint="Speech rate (0.7×–1.2×)"
                value={speed}
                min={0.7}
                max={1.2}
                step={0.05}
                onChange={setSpeed}
              />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Speaker boost</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enhances clarity & similarity
                  </p>
                </div>
                <Switch checked={speakerBoost} onCheckedChange={setSpeakerBoost} />
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- Scenes ---------- */}
        <section className="space-y-3">
          {scenes.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              This project doesn't have a reel script yet. Generate the reel
              first, then come back to add voiceover.
            </div>
          ) : (
            scenes.map((s) => {
              const asset = assetByScene.get(s.index);
              const isHook = s.index === 0;
              return (
                <div
                  key={s.index}
                  className="rounded-2xl border bg-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={isHook ? "default" : "secondary"}>
                        {isHook ? "Hook" : `Scene ${s.index}`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ~{s.durationSec}s
                      </span>
                      {s.onScreenText && (
                        <span className="truncate text-xs text-muted-foreground">
                          · on-screen: "{s.onScreenText}"
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {asset && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => playUrl(asset.url)}
                          >
                            <Play className="h-3.5 w-3.5" /> Play
                          </Button>
                          <a
                            href={asset.url}
                            download
                            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
                          >
                            <Download className="h-3.5 w-3.5" /> MP3
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(asset.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={sceneText[s.index] ?? ""}
                    onChange={(e) =>
                      setSceneText((p) => ({ ...p, [s.index]: e.target.value }))
                    }
                    placeholder="Voiceover text for this scene…"
                    rows={2}
                    className="resize-none text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Voice: {VOICE_CATALOG.find((v) => v.id === selectedVoiceId)?.name}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleGenerateScene(s.index)}
                      disabled={generating === s.index}
                    >
                      {generating === s.index ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      {asset ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}