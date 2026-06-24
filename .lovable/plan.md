# Reel Studio — Premium UI/UX Upgrade

A focused redesign pass. No new features, no backend changes. Visual system, layout, and interaction hierarchy only.

## 1. Design tokens (src/styles.css)

Introduce a calmer dark surface system used across Reel Studio (and available app-wide):

```text
--surface-base   #0B0B0C
--surface-1      #111214
--surface-2      #17181C
--border-soft    rgba(255,255,255,0.06)
--border-strong  rgba(255,255,255,0.10)
```

- Map shadcn tokens (`--background`, `--card`, `--popover`, `--border`, `--muted`) in dark mode onto this scale.
- Replace large neon/pink/purple gradient usage in Reel Studio with a single accent — keep `gradient-accent` reserved for the one Primary CTA per screen.
- Soften shadow utility (`shadow-ig` → lighter) and add `.elev-1` / `.elev-2` subtle elevations.

## 2. Button hierarchy

One rule per screen: exactly one solid Primary; everything else outline / ghost / icon.

- Primary: existing `default` (solid gradient) — reserve for the step's main CTA (Generate Script, Generate Audio, Generate Reel, etc.).
- Secondary: `outline` — supporting actions (Regenerate, Preview, Save Draft).
- Danger: red icon-only `ghost` button (Trash2, `text-destructive`). Desktop adds "Delete" label; mobile shows icon only with `aria-label`. Always wrapped in an AlertDialog confirm ("Are you sure you want to delete this project?").

Apply to `ReelStudio.tsx` and `ProjectsPage.tsx` (this is where the clipped Delete lives on mobile).

## 3. Reel Studio — Step Focus Mode

Replace the current always-expanded multi-tab layout with a single active step + breadcrumb stepper.

Steps: `Visual Direction → Reel Style → Script → Audio → Generate`.

- Top: a slim stepper bar (numbered pills + labels, current step highlighted, completed steps checked). Click a completed step to jump back.
- Only the active step renders its full UI. Inactive steps render nothing in the center column.
- Footer bar pinned at bottom of the center panel with `Back` (ghost, left) and the step's Primary CTA (right, solid). Replaces the inline "Continue" buttons currently scattered throughout.

## 4. Three-panel desktop layout

```text
┌─────────────┬──────────────────────────┬─────────────┐
│  CONTEXT    │        FOCUS             │   OUTPUT    │
│  (left)     │      (center)            │   (right)   │
│             │                          │             │
│ Source img  │  Active step content     │ Script      │
│ Settings    │  (one workspace only)    │ Scene break │
│ Style chip  │                          │ Final preview│
└─────────────┴──────────────────────────┴─────────────┘
```

- Grid: `lg:grid-cols-[280px_minmax(0,1fr)_340px]`. Tightened gaps, no nested boxed-over-boxed.
- Left panel: source image thumbnail, video settings summary (length / platform / aspect), selected Reel Style chip with "Change" link.
- Right panel: script preview (current draft), scene breakdown list (read-only), final reel preview (placeholder until rendered).
- Both side panels are `Collapsible`; collapsed by default on `< lg`.

## 5. Mobile layout

- Single column. Context + Output collapse into accordions above/below the focus step.
- The footer Back/Primary bar becomes a sticky bottom bar (`sticky bottom-0`, safe-area padding) so the Primary CTA is always reachable and never clipped.
- Horizontal scroll audit: every row that currently overflows gets `min-w-0` on text containers and `shrink-0` on icon/avatar widgets, per the responsive-layout pattern.

## 6. Visual cleanup pass

Across `ReelStudio.tsx`, `AudioEngine.tsx`, `ReelStylePresets.tsx`:

- Remove `ring-1 ring-accent-primary`, neon outlines, and double borders. Selected state = filled tinted background + check icon, no ring.
- Replace multi-color badges with neutral `secondary` badges; reserve the accent color for the active step and the Primary CTA only.
- Cut ~20–30% of decorative chrome: redundant section icons, duplicate step labels, multiple "tip" cards. Use spacing + heading weight for structure.
- Heading scale: `text-xl font-semibold` for step titles, `text-sm text-muted-foreground` for descriptions, `text-base font-medium` for subsection labels. Drop bold on body text.

## 7. ProjectsPage delete fix

- Trash button → `Button variant="ghost" size="icon"` with `text-destructive`, label hidden via `sr-only` on `< sm`, visible on `≥ sm`.
- Wrap in `AlertDialog`: title "Delete project?", description naming the project, Cancel + Delete (destructive).
- Ensure the card actions row uses `grid-cols-[minmax(0,1fr)_auto]` so the icon never clips.

## Files touched

- `src/styles.css` — surface tokens, softened shadows, dark-mode token remap.
- `src/components/ReelStudio.tsx` — step focus mode, 3-panel layout, footer CTA bar, hierarchy cleanup.
- `src/components/AudioEngine.tsx` — visual cleanup (borders, badges, spacing); no logic changes.
- `src/components/ReelStylePresets.tsx` — selected-state without ring; tighter grid.
- `src/components/ProjectsPage.tsx` — delete button + confirm dialog, mobile-safe action row.

## Out of scope (explicit)

- No new features, no new server functions, no schema changes.
- No copy rewrites beyond button labels needed for hierarchy.
- Light mode untouched beyond shadcn token consistency.

## Verification

- Build passes.
- Playwright at 375px and 1280px on `/studio/reel`: stepper visible, only one step rendered, Primary CTA reachable, no horizontal scroll, Delete icon not clipped on `/projects`.

Approve to proceed, or tell me what to cut/add.
