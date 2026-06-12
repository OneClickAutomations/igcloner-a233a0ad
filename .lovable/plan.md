## What the spec asks for

A full **Production Studio** layered on top of the existing analyzer:

1. After analysis, user picks a format (Reel, Carousel, Voiceover, Caption, Image).
2. Each format opens a dedicated studio at `/studio/<format>` that auto-imports the analyzed post's DNA, hooks, thumbnail, and user preferences as a saved "Project".
3. Reel Studio = script generator + AI video prompt generator for VEO/Kling/Sora (no API calls — copy/paste).
4. Carousel Studio = N-slide generator with per-slide editor, design brief, caption.
5. Voiceover Studio = ElevenLabs TTS with voice picker, settings, audio player, download.
6. Caption flow gets a "Post This" modal.
7. Sidebar gains Projects + studio shortcuts.

## Honest assessment before we build

- **Scope is large** (~1,100 lines of spec). Building it all in one pass will produce broken-but-impressive UI and burn credits. I will ship it in 4 vertical slices that each leave the app working.
- **Conflicts with the current plan.md** (`/discover`, viral scoring stages B/C, Blotato scheduler, Kling/Veo direct video generation). I will pause that roadmap and replace it with this studio roadmap. Stage A (viral score + Decision Card) we just shipped stays — the Decision Card's "Generate clones" button will route into the format picker.
- **Stack mismatch in the spec**: it shows Supabase Edge Functions in Deno. Our app is TanStack Start — server functions live in `src/lib/*.functions.ts` and call Lovable AI Gateway. I will translate every "edge function" in the spec to a TanStack server function. Functionality is identical.
- **ElevenLabs** is not in our AI Gateway — needs a user-supplied `ELEVENLABS_API_KEY` secret. I will add it via the secrets tool **only when we reach Stage 3 (Voiceover)** so you aren't blocked on the early stages.
- **Pexels** stock footage is optional polish — skipping in v1.
- **VEO/Kling/Sora**: spec explicitly says copy-prompt + link-out, not direct API. Matches what we can ship today without extra keys.

## Build plan — 4 stages

### Stage 1 — Foundation (ship first, ~1 turn)
- Migration: `projects` table (+ GRANTs, RLS), `project_assets` table, storage bucket `project-assets` (public read, owner write).
- New page **`/studio`** = format picker (5 cards: Reel, Carousel, Voiceover, Caption, Image). Reached from the Decision Card "Generate clones" button → renamed **"Create Content ▼"** dropdown on the analyze screen.
- Server fns: `createProject`, `listProjects`, `getProject`, `updateProject`.
- Sidebar gets a **Projects** entry. Dashboard gets a "My Projects" grid.
- Caption / Image formats just route into the existing clone flow with the project ID attached. No new generation yet.

### Stage 2 — Carousel Studio (highest user value, no new secrets)
- Route `/studio/carousel?projectId=…`, two-column layout.
- Server fn `generateCarousel(projectId, settings)` calls Lovable AI Gateway with the spec's exact JSON schema (slides, design system, caption, hashtags, hook variations). Persists to `projects.project_data`.
- Slide editor: list of slides on the left, per-slide form on the right (headline, body, visual direction, regenerate). Auto-save on edit.
- Export: copy all headlines / copy caption+hashtags / download design brief as TXT / open Canva link.

### Stage 3 — Voiceover Studio (needs ElevenLabs key)
- Ask for `ELEVENLABS_API_KEY` via the secrets tool at the start of this stage.
- Route `/studio/voiceover?projectId=…`.
- Server fns: `generateVoiceoverScript` (AI Gateway, returns hook/body/cta segments + estimated duration) and `generateVoiceover` (calls ElevenLabs `/v1/text-to-speech/{voiceId}/stream`, uploads MP3 to `project-assets` storage, inserts `project_assets` row).
- UI: script editor on the left, voice picker (6 prebuilt voices) + stability/similarity/style sliders + speed selector on the right, audio player with download.

### Stage 4 — Reel Studio + Caption "Post This" modal
- Route `/studio/reel?projectId=…`, three-column layout.
- Server fns: `generateReelScript` (hook + scenes + CTA + 5 hook variations) and `generateVideoPrompts` (master + veoPrompt + klingPrompt + soraPrompt + per-scene prompts).
- Center panel: video engine picker (VEO / Kling / Sora / Script Only), settings (format/duration/style/pace), script blocks (editable), prompts blocks, caption + hashtags.
- Right panel: copy/export actions + open-in-tool links (VEO, Kling, Sora, CapCut, Canva).
- Upgrade existing clone cards with the "Post This →" modal.
- **Skipping in v1**: stock-footage search (Pexels), voice-cloning upload, calendar integration. Easy follow-ups.

## Technical translation notes (non-technical reader can skip)

- All "edge functions" in the spec → TanStack server functions in `src/lib/*.functions.ts`, auth-gated with `requireSupabaseAuth`. The AI provider is Lovable AI Gateway (no per-user OpenAI/Anthropic key).
- All `projects.user_id` references `auth.users(id)` directly (we don't have a `profiles` table). RLS scopes everything to `auth.uid()`.
- The Decision Card's existing "Generate clones" button becomes "Create Content" and opens the format picker instead of running the clone generator immediately.
- Storage bucket policies follow Lovable Cloud conventions (folder = user id), per the spec.

## What I'm asking you

Confirm the staging and I'll start Stage 1 right away. Two small choices to confirm before I migrate:

1. **Replace the current plan.md `/discover` + Blotato roadmap** with this studio roadmap? (My recommendation: yes — the studio is what your spec actually demands; Discover/Scheduling can be Phase 2 after the studios ship.)
2. **Keep the analyze screen's existing single-call "generate 5 clones" behavior intact**, with the format picker offered as an *additional* path (so nothing the user has today regresses)? Or fully replace it with the format-picker gate?
