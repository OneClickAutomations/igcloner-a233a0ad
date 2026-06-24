import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Music,
  Mic,
  Waves,
  Sparkles,
  Volume2,
  Wand2,
  Sliders,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AudioMode,
  type AudioMixProfile,
  type AudioPlan,
  type SfxIntensity,
  type MusicGenre,
  DEFAULT_MIX,
  MUSIC_GENRES,
  VOICE_CATEGORIES,
  CAPTION_STYLES,
  PLATFORM_OPTIONS,
} from "@/lib/audio-types";
import { VOICE_CATALOG, generateSceneVoiceover } from "@/lib/voiceover.functions";
import { generateMusicBed } from "@/lib/music.functions";
import { generateSoundFx } from "@/lib/sfx.functions";
import { planAudioStrategy } from "@/lib/audio-director.functions";

const MODES: { v: AudioMode; l: string; sub: string }[] = [
  { v: "auto",            l: "Auto Mode",                 sub: "AI builds the full audio plan (recommended)" },
  { v: "voice-music",     l: "Voice + Music",             sub: "Voiceover layered over a music bed" },
  { v: "voice-music-sfx", l: "Voice + Music + SFX",       sub: "Cinematic mix with sound design" },
  { v: "voiceover",       l: "Voiceover Only",            sub: "Clean narration, no music" },
  { v: "music",           l: "Music Only",                sub: "Instrumental bed, no voice" },
  { v: "ambient",         l: "Ambient Audio",             sub: "Realistic environmental soundscape" },
  { v: "native",          l: "Native Video Audio",        sub: "Use whatever audio the video model generates" },
];

const SFX_OPTS: { v: SfxIntensity; l: string }[] = [
  { v: "none",       l: "None" },
  { v: "subtle",     l: "Subtle" },
  { v: "standard",   l: "Standard" },
  { v: "cinematic",  l: "Cinematic" },
  { v: "heavy",      l: "Heavy" },
];

export function AudioEngine({
  projectId,
  imageUrl,
  angle,
  stylePreset,
  initialPlan,
  initialMix,
  onChange,
}: {
  projectId: string;
  imageUrl?: string;
  angle?: string;
  stylePreset?: string;
  initialPlan?: AudioPlan;
  initialMix?: AudioMixProfile;
  onChange: (plan: AudioPlan, mix: AudioMixProfile) => void;
}) {
  const [plan, setPlan] = useState<AudioPlan>(
    initialPlan ?? { mode: "auto", sfxIntensity: "subtle", captionStyle: "dynamic", platform: "instagram" },
  );
  const [mix, setMix] = useState<AudioMixProfile>(initialMix ?? DEFAULT_MIX);
  const [busy, setBusy] = useState<null | "plan" | "voice" | "music" | "ambient" | "sfx">(null);

  const planFn = useServerFn(planAudioStrategy);
  const voiceFn = useServerFn(generateSceneVoiceover);
  const musicFn = useServerFn(generateMusicBed);
  const sfxFn = useServerFn(generateSoundFx);

  const update = (p: Partial<AudioPlan>, m?: Partial<AudioMixProfile>) => {
    const next = { ...plan, ...p };
    const nextMix = m ? { ...mix, ...m } : mix;
    setPlan(next);
    if (m) setMix(nextMix);
    onChange(next, nextMix);
  };
  const updateMix = (m: Partial<AudioMixProfile>) => {
    const nm = { ...mix, ...m };
    setMix(nm);
    onChange(plan, nm);
  };

  const filteredVoices = useMemo(() => {
    if (!plan.voiceCategory) return VOICE_CATALOG;
    return VOICE_CATALOG.filter((v) => v.categories.includes(plan.voiceCategory as any));
  }, [plan.voiceCategory]);

  async function runDirector() {
    setBusy("plan");
    try {
      const r: any = await planFn({
        data: {
          projectId,
          stylePreset,
          imageUrl,
          angle,
          platform: plan.platform,
        },
      });
      const p = r.plan;
      update({
        mode: p.mode || "voice-music",
        voiceCategory: p.voiceCategory,
        voiceTone: p.voiceTone,
        musicGenre: p.musicGenre,
        musicPrompt: p.musicPrompt,
        ambientPrompt: p.ambientPrompt,
        sfxIntensity: p.sfxIntensity,
        captionStyle: p.captionStyle,
        strategy: p.strategy,
        hookVariations: p.hookVariations,
        scriptMode: plan.scriptMode ?? "auto",
      });
      toast.success("AI Creative Director ready");
    } catch (e: any) {
      toast.error(e?.message || "Director failed");
    } finally {
      setBusy(null);
    }
  }

  async function genVoice() {
    if (!plan.voiceId) {
      toast.error("Pick a voice first");
      return;
    }
    const text = (plan.script || plan.hookVariations?.[0] || angle || "").slice(0, 4000);
    if (!text) {
      toast.error("No script to read — paste or generate one first");
      return;
    }
    setBusy("voice");
    try {
      const r: any = await voiceFn({
        data: { projectId, sceneIndex: 0, text, voiceId: plan.voiceId },
      });
      update({ voiceAssetUrl: r.audioUrl });
      toast.success("Voiceover generated");
    } catch (e: any) {
      toast.error(e?.message || "Voiceover failed");
    } finally {
      setBusy(null);
    }
  }

  async function genMusic() {
    const genre = (plan.musicGenre || "cinematic") as MusicGenre;
    if (genre === "none") return;
    setBusy("music");
    try {
      const r: any = await musicFn({
        data: {
          projectId,
          genre,
          prompt: plan.musicPrompt || `${genre} bed for short-form social video`,
          durationSec: 20,
        },
      });
      update({ musicAssetUrl: r.url });
      toast.success("Music bed ready");
    } catch (e: any) {
      toast.error(e?.message || "Music generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function genAmbient() {
    if (!plan.ambientPrompt) {
      toast.error("Describe the ambience (e.g. 'gentle ocean waves with distant gulls')");
      return;
    }
    setBusy("ambient");
    try {
      const r: any = await sfxFn({
        data: {
          projectId,
          prompt: plan.ambientPrompt,
          kind: "ambient",
          durationSec: 15,
          promptInfluence: 0.3,
        },
      });
      update({ ambientAssetUrl: r.url });
      toast.success("Ambient track ready");
    } catch (e: any) {
      toast.error(e?.message || "Ambient generation failed");
    } finally {
      setBusy(null);
    }
  }

  const showVoice = ["voiceover", "voice-music", "voice-music-sfx", "auto"].includes(plan.mode);
  const showMusic = ["music", "voice-music", "voice-music-sfx", "auto"].includes(plan.mode);
  const showAmbient = ["ambient", "auto"].includes(plan.mode);
  const showSfx = ["voice-music-sfx", "auto"].includes(plan.mode);

  return (
    <div className="space-y-6">
      {/* AI Director */}
      <div className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-accent-primary" />
              <div className="text-sm font-semibold">AI Creative Director</div>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Recommended</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              One click — the Director analyzes your image, brief, style, and platform, then writes the full audio plan, hooks, and mix.
            </p>
          </div>
          <Button size="sm" onClick={runDirector} disabled={busy === "plan"} className="gradient-accent text-white border-0">
            {busy === "plan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Plan it
          </Button>
        </div>
        {plan.strategy && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(["visual", "motion", "voice", "music", "sound", "hook"] as const).map((k) =>
              plan.strategy?.[k] ? (
                <div key={k} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k}</div>
                  <div className="mt-1 text-xs leading-snug">{plan.strategy[k]}</div>
                </div>
              ) : null,
            )}
          </div>
        )}
        {plan.hookVariations?.length ? (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Hook variations — pick one</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {plan.hookVariations.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => update({ script: h })}
                  className={`rounded-lg border p-2 text-left text-xs ${
                    plan.script === h ? "border-accent-primary bg-accent-primary/10" : "border-border bg-card hover:border-accent-primary/60"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Audio mode */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-accent-primary" />
          <div className="text-sm font-semibold">Audio Experience</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => update({ mode: m.v })}
              className={`rounded-lg border p-2.5 text-left text-xs transition ${
                plan.mode === m.v
                  ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary"
                  : "border-border bg-background hover:border-accent-primary/60"
              }`}
            >
              <div className="font-semibold">{m.l}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Voiceover */}
      {showVoice && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-accent-primary" />
              <div className="text-sm font-semibold">Voiceover Studio</div>
            </div>
            <Button size="sm" variant="outline" onClick={genVoice} disabled={busy === "voice"}>
              {busy === "voice" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Generate
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Voice type</Label>
              <Select value={plan.voiceCategory} onValueChange={(v) => update({ voiceCategory: v, voiceId: undefined })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a voice persona" /></SelectTrigger>
                <SelectContent>
                  {VOICE_CATEGORIES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Voice</Label>
              <Select value={plan.voiceId} onValueChange={(v) => update({ voiceId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a voice" /></SelectTrigger>
                <SelectContent>
                  {filteredVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} — {v.accent}, {v.gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label className="text-xs">Script</Label>
            <Textarea
              className="mt-1 min-h-[80px]"
              value={plan.script || ""}
              onChange={(e) => update({ script: e.target.value })}
              placeholder="Paste a script, or generate hooks above with the AI Director."
            />
          </div>
          {plan.voiceAssetUrl && (
            <audio src={plan.voiceAssetUrl} controls className="mt-3 w-full" />
          )}
        </div>
      )}

      {/* Music */}
      {showMusic && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-accent-primary" />
              <div className="text-sm font-semibold">Music Engine</div>
            </div>
            <Button size="sm" variant="outline" onClick={genMusic} disabled={busy === "music" || plan.musicGenre === "none"}>
              {busy === "music" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Generate
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Genre / mood</Label>
              <Select value={plan.musicGenre} onValueChange={(v) => update({ musicGenre: v as MusicGenre })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a genre" /></SelectTrigger>
                <SelectContent>
                  {MUSIC_GENRES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Music description (optional)</Label>
              <Textarea
                className="mt-1 min-h-[64px]"
                value={plan.musicPrompt || ""}
                onChange={(e) => update({ musicPrompt: e.target.value })}
                placeholder="e.g. 'driving cinematic build with deep sub bass, slow ramp into a climax'"
              />
            </div>
          </div>
          {plan.musicAssetUrl && (
            <audio src={plan.musicAssetUrl} controls className="mt-3 w-full" />
          )}
        </div>
      )}

      {/* Ambient */}
      {showAmbient && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-accent-primary" />
              <div className="text-sm font-semibold">Ambient Engine</div>
            </div>
            <Button size="sm" variant="outline" onClick={genAmbient} disabled={busy === "ambient"}>
              {busy === "ambient" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Generate
            </Button>
          </div>
          <Label className="text-xs">Describe the environment</Label>
          <Textarea
            className="mt-1 min-h-[64px]"
            value={plan.ambientPrompt || ""}
            onChange={(e) => update({ ambientPrompt: e.target.value })}
            placeholder="e.g. 'gentle ocean waves with distant seagulls and a soft breeze'"
          />
          {plan.ambientAssetUrl && (
            <audio src={plan.ambientAssetUrl} controls className="mt-3 w-full" />
          )}
        </div>
      )}

      {/* SFX */}
      {showSfx && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-primary" />
            <div className="text-sm font-semibold">Sound Effects</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {SFX_OPTS.map((s) => (
              <button
                key={s.v}
                type="button"
                onClick={() => update({ sfxIntensity: s.v })}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  plan.sfxIntensity === s.v
                    ? "border-accent-primary bg-accent-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Scene-level SFX (whooshes, impacts, text reveals) are rendered automatically based on motion at final mix.
          </p>
        </div>
      )}

      {/* Mixer */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-accent-primary" />
            <div className="text-sm font-semibold">Audio Mixer</div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Auto-duck</Label>
            <Switch checked={mix.autoDuck} onCheckedChange={(v) => updateMix({ autoDuck: v })} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ["voice", "Voice"],
            ["music", "Music"],
            ["ambient", "Ambient"],
            ["sfx", "SFX"],
            ["master", "Master"],
          ] as const).map(([k, l]) => (
            <div key={k}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{l}</span>
                <span className="font-mono text-muted-foreground">{mix[k]}</span>
              </div>
              <Slider
                value={[mix[k]]}
                onValueChange={(v) => updateMix({ [k]: v[0] } as any)}
                min={0}
                max={100}
                step={1}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Platform + caption */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <Label className="text-xs">Target platform</Label>
          <Select value={plan.platform} onValueChange={(v) => update({ platform: v as any })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a platform" /></SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l} — {o.aspect}, ≤{o.maxLen}s</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Label className="text-xs">Caption style</Label>
          <Select value={plan.captionStyle} onValueChange={(v) => update({ captionStyle: v as any })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick caption style" /></SelectTrigger>
            <SelectContent>
              {CAPTION_STYLES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}