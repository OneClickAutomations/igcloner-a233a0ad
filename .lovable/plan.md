# IGCloner — Linear Flow Rebuild

This is a large rebuild. To ship it safely I'll execute in phases, each phase leaving the app in a working state. I'll build straight through phases 1–3 first (the core flow), then ask before starting phase 4 (image studio — requires a new API key) and phase 5 (voiceover — requires ElevenLabs key).

## Scope decisions (please flag any you disagree with)

- **AI provider**: keep Claude for DNA analysis (already working). Use **Lovable AI Gemini** for angles, scripts, carousel, post copy, and 30-day plan — no new key needed.
- **Image studio**: spec calls for Nano Banana. Lovable AI already exposes `google/gemini-2.5-flash-image` ("Nano Banana") with no extra key. I'll use that instead of a separate `NANO_BANANA_API_KEY`.
- **Voiceover**: requires `ELEVENLABS_API_KEY` (new secret). I'll request this only when we reach Phase 5.
- **Instagram direct posting**: out of scope (requires Meta Graph API app review). I'll keep the "copy caption / open Instagram" flow from the spec and the schedule-for-later DB record, but not auto-publish.
- **30-day plan**: I'll wire the generator + calendar grid, but Path B (full from-scratch wizard) is built as a single combined form rather than 7 separate screens to keep scope sane. Same outputs.

## Phase 1 — Core flow rewrite (URL → Angles → Format picker)

- Rewrite `AppPage.tsx` into the new linear layout: URL input → Intelligence Card + collapsible DNA → 5 Angles → Format picker.
- New server fn `generateAngles` in `src/lib/angles.functions.ts` (Lovable AI Gemini, returns 5 angle objects with hook, why-it-performs, recommended format, viral score).
- New `AnglesGrid` + `FormatPicker` + `IntelligenceCard` components.
- Niche quick-set chips inline above angles (skip if already saved on profile).
- On format select: create `projects` row (status `in_progress`, stores `angle` + `format`) and navigate to the right studio with `?projectId`.
- Delete the old `PostAnalysisFlow`, V1–V5 clone auto-gen, and pre-format preferences panel paths.

## Phase 2 — Reel Studio upgrade (already 80% there)

- Convert existing `ReelStudio` to the 4-tab layout: Script · VEO Prompts · Voiceover · Post Copy.
- Tabs 1, 2, 4 wire to existing/extended `reel.functions.ts` (already produces script + veoPrompt; I'll add per-scene VEO prompts + post copy regen).
- Tab 3 (Voiceover) shows a "Connect ElevenLabs" empty state until Phase 5.
- Add Post Now / Schedule modal (universal — shared component).

## Phase 3 — Carousel Studio upgrade

- Convert `CarouselStudio` to side-by-side layout: settings + slide nav (left) / slide editor + Canva instructions + post copy (right).
- Extend `carousel.functions.ts` to also return per-slide Canva build instructions (font/size/hex/positions).
- Wire Post Now / Schedule modal.

## Phase 4 — Image Studio (asks first)

- New `/studio/image` route + `ImageStudio.tsx` with the two-column layout from the spec.
- New server route `src/routes/api/generate-image.ts` streaming `google/gemini-2.5-flash-image` via the AI gateway, with prompt builder from concept + style + text overlay + brand.
- New Supabase storage bucket `project-assets` (private, RLS-scoped to `user_id`) for generated PNGs.
- Post copy via shared `generatePostCopy` fn.

## Phase 5 — Voiceover + 30-Day Plan (asks first)

- ElevenLabs voiceover edge function (requires `ELEVENLABS_API_KEY` — I'll request it at this phase).
- `generate30DayPlan` server fn + `/calendar/generate` route with calendar grid, CSV/PDF export.
- Path A (from project) and Path B (combined questionnaire).

## Technical notes

- All new AI calls go through `createLovableAiGatewayProvider` (already in `src/lib/ai-gateway.server.ts`) — no new keys for text generation.
- New tables: none for Phase 1–3. Phase 5 adds `calendar_plans` (id, user_id, source_project_id, items jsonb, created_at) with the standard GRANT + RLS block.
- Existing `calendar_items` table reused for scheduling.
- Universal `PostScheduleModal` component shared by all studios.
- Mobile: every studio collapses to stacked single-column at <768px.

## What gets deleted

- `src/components/PostAnalysisFlow.tsx` (replaced by inline angles + format picker in `AppPage`)
- Auto-generated clone tabs / `clones` table reads on the app page (the table stays for now in case dashboard uses it)
- The pre-format preferences panel — preferences now live inside each studio

## Ready to start?

Reply "go" and I'll execute Phases 1–3 straight through, then check in before Phase 4 (image studio) since it adds a storage bucket and a new AI surface.
