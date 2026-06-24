## Reel Studio → Premium Production Studio

This is a large multi-week build. I'll deliver it in phases so each ships working, and you can steer between phases. Phase 1 lays the foundation (workflow + audio engine wiring) and is the heaviest lift. Later phases layer on polish, presets, and premium features.

---

### Phase 1 — Core workflow + Audio Engine (this turn)

Restructure `ReelStudio.tsx` into an explicit 5-step flow with a top progress rail:

```text
1. Visual Source → 2. Reel Style → 3. Audio Experience → 4. Creative Director Review → 5. Render
```

**Step 1 — Visual Source**
Replace today's image picker with a tabbed selector: Uploaded · Scraped · Generated · Collection · Carousel Slides. (Backed by existing `project_assets`.)

**Step 2 — Reel Style**
New preset grid (Documentary, Educational, Luxury, Business, Motivational, Storytelling, News, Nature, Product Showcase, Lifestyle, Cinematic, Viral Reel). Each preset seeds visual direction + motion + audio defaults.

**Step 3 — Audio Experience (new, the big addition)**
Top-level mode picker: Native · Voiceover · Music Only · Voice+Music · Voice+Music+SFX · Ambient Only · **Auto (recommended)**.

Sub-panels appear based on mode:
- **Voiceover Studio** — reuses existing `voiceover.functions.ts` + ElevenLabs key already in secrets. Adds Voice Type presets (Narrator, Storyteller, Doc Host, Business Expert, Motivational, News Anchor, Luxury, Casual Creator, Podcast Host) mapped to curated voice IDs. Script options: Generate / Paste / Hook only / CTA only / Auto from Content DNA.
- **Music Engine** — genre picker (Trending, Cinematic, Motivational, Luxury, Corporate, Inspiring, Tech, Documentary, Emotional, Nature, Ambient, LoFi, Electronic, Epic, None). Generation via ElevenLabs Music API (new server fn `music.functions.ts`).
- **Ambient Engine** — AI-suggested ambient tracks from image analysis (Ocean/Forest/City/Coffee Shop/Office/Nature). Generated via ElevenLabs Sound Effects API (new `ambient.functions.ts`).
- **SFX Engine** — intensity picker (None/Subtle/Standard/Cinematic/Heavy). Scene-motion-driven SFX via same SFX endpoint.
- **Audio Mixer** — sliders for Voice / Music / Ambient / SFX / Master, plus Auto-Duck toggle and "AI Mix" button. Stored as a mix profile on the reel doc.

**Step 4 — AI Creative Director**
Pre-render summary card showing: Visual Strategy · Motion Strategy · Voice Strategy · Music Strategy · Sound Strategy · Hook Strategy. Plus 3 hook variations + 3 opening scripts + 3 audio strategies (user picks one).

**Step 5 — Render**
Length (5/10/15/30/45/60/90s) — model routing (5/10s native, longer via concatenated scenes). Platform (IG/TikTok/Shorts/FB/LinkedIn/X) sets aspect ratio + max length + caption style. Caption options (Burned-In, SRT, Dynamic word-highlight, TikTok/Instagram/Premium/Brand styles).

**New server functions (Phase 1):**
- `src/lib/music.functions.ts` — ElevenLabs `/v1/music`
- `src/lib/ambient.functions.ts` — ElevenLabs `/v1/sound-generation` (with "analyze image → suggest ambient" via Lovable AI Gateway)
- `src/lib/audio-director.functions.ts` — Auto-mode planner (image + style + audience → full audio strategy JSON)
- Extend `reel.functions.ts` `ReelDoc` with `audioPlan`, `mixProfile`, `captionStyle`, `platform`, `lengthSec`

**Storage:** all generated audio uploaded to existing `project-assets` bucket; signed URLs.

---

### Phase 2 — Caption Studio + Hook lab (next turn)
- Burned-in caption rendering server-side (ffmpeg via fal.ai caption endpoint or `fal-ai/auto-caption`)
- Word-level highlight from ElevenLabs STT timestamps
- Style presets (TikTok bouncing, IG clean, Premium serif, Brand from saved profile)
- Hook A/B lab with thumbnail preview per variation

### Phase 3 — Presets & Templates
- Brand Voice Profiles (saved voice + mix settings)
- Voice Clones (ElevenLabs instant clone upload)
- Saved Audio Presets, Reel Presets, Creator Templates, Industry Templates
- New tables: `audio_presets`, `reel_presets`, `brand_voices` with RLS

### Phase 4 — Polish & QA
- Final mixer with waveform preview (wavesurfer.js)
- Auto-ducking implementation (sidechain via Web Audio API for preview, ffmpeg for final)
- Multi-scene stitching for 30s+ reels
- Per-platform export profiles (bitrate, fps, safe-area)

---

### Scope check before I build Phase 1

A few choices that materially change the implementation:

1. **ElevenLabs key** — already in your secrets as `ELEVENLABS_API_KEY`. I'll use that for all users (workspace-shared) instead of asking each user to paste their own. OK?
2. **Music generation** — ElevenLabs `/v1/music` is currently in limited access. If your key doesn't have it enabled, I'll fall back to a curated royalty-free track library (or Suno via API). Confirm: try ElevenLabs first, fall back to library?
3. **Voice cloning** — ElevenLabs Instant Voice Clone requires a paid tier. Defer to Phase 3?
4. **Render length > 10s** — fal Veo3/Kling cap at 8–10s. I'll stitch multi-scene clips with ffmpeg in a queued server route. OK to keep that as Phase 4?

Reply with answers (or "go ahead with your defaults") and I'll build Phase 1.
