## Goal

Upgrade IGCloner's generation quality per the Deep Cloning Engine spec, in a focused, shippable way that fits the current code (Gemini via Lovable AI Gateway, TanStack Start, existing Carousel + Reel studios). Plus the small UI ask: an "enlarge" icon on generated carousel slides.

## Scope (what I'll build now)

1. **Forensics extraction in `analyze.functions.ts`**
   - Extend the single Gemini call to also return a `forensics` object whose shape depends on `postType`:
     - `imageForensics` for Post
     - `videoForensics` for Reel
     - `carouselForensics` for Carousel
   - Store it inside the existing `dna_analysis` JSONB (additive, no migration).
   - Pass it through `getAnalysisById` so studios can read it.

2. **Clone mode (Exact Duplicate / Inspired Version)**
   - New `cloneMode: 'exact' | 'inspired'` on every studio.
   - Default = `exact`. Persist on `projects.user_preferences.cloneMode` so it round-trips.
   - Surface a 2-option toggle on Studio format picker AND inside each studio's pre-generation panel.

3. **Carousel generator upgrade (`carousel.functions.ts`)**
   - Accept `cloneMode` + receive forensics from analysis.
   - Use the two prompt templates from the spec (exact = formula recreation; inspired = mechanics-only).
   - Keep current output schema (`CarouselDoc`) so the editor keeps working; the prompts simply produce higher-fidelity slides + design brief.

4. **Reel generator upgrade (`reel.functions.ts`)**
   - Same: accept `cloneMode`, feed videoForensics into the Gemini prompt, produce a stronger script + VEO 3 prompt.
   - Keep current output schema.

5. **Content Formula summary card on /app**
   - New `ContentFormulaCard` shown above the existing DNA results.
   - Renders 3 tiles (Format / Psychology / Metrics) populated from forensics + scraped stats.
   - Two CTAs: "Create Exact Duplicate" and "Create Inspired Version" → navigate to `/studio?analysisId=…&mode=exact|inspired`.
   - `/studio` reads `mode` from search and pre-selects the toggle when creating the project.

6. **Carousel slide enlarge viewer (UI request)**
   - Add a Maximize2 icon button on each slide in the carousel editor + on the active slide header.
   - Click → opens a Dialog with a full 1080×1080-styled preview using the slide's headline/body + design brief palette so the user can eyeball the layout.
   - Keyboard ← / → to navigate slides inside the modal.

## Out of scope for this turn (called out in spec, deferred)

- Image Studio (the spec's "Image Cloner Engine"). The app has no Image studio yet; building it is its own stage. Forensics are still captured so it slots in cleanly later.
- Midjourney/DALL-E/Lightroom export buttons — depend on the Image studio.
- PDF design-brief export — current text export already covers Canva; PDF needs a Worker-safe renderer (separate task).
- Drag-to-reorder slides + "+ Add Slide" inside carousel editor (not currently supported; spec mentions but app's regenerate flow doesn't allow it yet).

## Technical notes (for reviewer)

- All AI work stays on `google/gemini-3-flash-preview` via the existing `createLovableAiGatewayProvider`. Claude is retained only for the parts of `analyze.functions.ts` that already use it (none right now — the file already migrated to Gemini).
- Forensics schema is added as `z.object({ ... }).partial().optional()` so older saved analyses still parse.
- `cloneMode` flows: `/app` CTA → `/studio?mode=…` → `createProject({ userPreferences: { cloneMode } })` → studio reads `project.user_preferences.cloneMode` → generator server fn reads it from the project row (no extra param plumbing).
- Enlarge viewer is pure client (shadcn Dialog + the existing palette tokens), no server work.

## Files touched

- `src/lib/analyze.functions.ts` — forensics extraction + return
- `src/lib/carousel.functions.ts` — exact/inspired prompts, read forensics + cloneMode
- `src/lib/reel.functions.ts` — exact/inspired prompts, read forensics + cloneMode
- `src/lib/projects.functions.ts` — accept `cloneMode` on create
- `src/components/StudioPage.tsx` — clone-mode toggle, pass through on create
- `src/components/CarouselStudio.tsx` — clone-mode badge, slide enlarge dialog
- `src/components/ReelStudio.tsx` — clone-mode badge, exact/inspired indicator
- `src/components/AppPage.tsx` — mount new ContentFormulaCard with dual CTAs
- `src/components/ContentFormulaCard.tsx` *(new)*
- `src/components/SlidePreviewDialog.tsx` *(new)*
- `src/routes/_authenticated/studio.tsx` — add `mode` to validateSearch

Say "go" to build it. If you'd rather I trim or add anything (e.g. include the Image Studio now, or skip the Content Formula card), tell me and I'll adjust before writing code.