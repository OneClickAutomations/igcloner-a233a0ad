## A1 Mode v2 — Multi-Platform Rebuild

Implementing the spec in `IGCloner_A1_Mode_v2_Multiplatform.md` as a focused, end-to-end upgrade to the Image Studio (A1 mode). A2/A3 behavior is untouched.

### New User Flow

```
A1 → preferences (niche, tone) → [NEW] Goal selector
   → generate 5 goal-optimized angles → pick angle
   → [NEW] Platform picker (IG, LI, X, FB, YT, Threads, Pinterest, Reddit, Bluesky)
   → [NEW] Branding panel (@handle + logo, 6 positions)
   → Studio with per-platform tabs (image identical, copy adapts)
   → Post/Schedule modal with one row per platform
```

### What I'll Build

1. **Types & constants**
   - `src/lib/post-goals.ts` — 8 goals + goal-driven copy instructions
   - `src/lib/platform-voice.ts` — 9 platform voice profiles
   - Extend `src/lib/branding.ts` types (already exists)

2. **Goal selector UI** — required field added to the existing A1 preference panel inside `ImageStudio.tsx`. Generate button disabled until niche + goal selected.

3. **Angles generation update** — extend `src/lib/angles.functions.ts` so A1 prompt injects the selected goal's instructions and returns a `goalAlignment` field per angle.

4. **Platform picker step** — new screen between angle-selection and studio: 9-platform checkbox grid with Select All / Clear All and the "simultaneous posting coming soon" notice.

5. **Branding panel** — upgrade existing `BrandingPanel.tsx`:
   - @handle input + toggle
   - Logo toggle, source (brand kit / upload), upload control
   - 6-position picker (3×2 grid) with auto-suggest opposite-corner from text overlay
   - Live preview composite (text overlay + branding)

6. **Brand kit storage** — migration: `brand_kit_assets` table (id, user_id, type, name, url, created_at) with proper grants + RLS + has_role-style user policies. Server fns: `listBrandKit`, `addBrandKitAsset`, `deleteBrandKitAsset`. Logo uploads reuse existing reference-upload pipeline.

7. **Per-platform copy generation** — new `src/lib/platform-copy.functions.ts` server fn `generatePlatformCopy({ angle, platforms, goal, niche, tone })` that calls the Lovable AI gateway once per platform in parallel and returns `{ platform, hook, caption, description, hashtags, cta, characterCount, platformFitNotes }[]`.

8. **Studio platform tabs** — tabs in `ImageStudio.tsx` for each selected platform. Left pane = identical branded image preview. Right pane = that platform's copy with hook, post text, hashtags, CTA, "Regenerate for {platform}", and Copy buttons. Top header shows the active goal.

9. **Post modal** — update `PostThisModal.tsx` to render one row per selected platform with Copy Caption / Copy Hashtags / Open ↗ (deep link to each platform's composer) plus a single Download Branded Image button and the "coming soon: auto-post" notice.

10. **Persistence** — extend the existing image project record to store `goal`, `selectedPlatforms`, `platformCopy[]`, `branding` so reopening the project restores everything.

### Technical Notes (for devs)

- Goal + platform instruction blocks are hardcoded TS modules (not regenerated per request) — keeps prompts cheap and consistent.
- `generatePlatformCopy` uses `Promise.all` with the existing AI gateway helper; JSON extraction goes through `src/lib/json-extract.ts`.
- Branded image export = canvas composite (source image + text overlay + branding badge) shared across all platform tabs — one PNG.
- Auto-position rule: text in top-third → branding bottom-right; text in bottom-third → top-right; default bottom-right.
- DB migration follows project rules: `CREATE TABLE` → `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` → `ENABLE RLS` → user-scoped policies via `auth.uid()`.
- Upload-Post API integration is intentionally NOT built — only the "coming soon" notice ships, per spec rule 11.
- A2/A3 modes and their components are not touched.

### Out of Scope (per spec)

- Actual cross-platform auto-posting (Upload-Post API) — surfaced as "coming soon" only.
- Visual/design override panel changes — current collapsed A1 behavior preserved.

After you approve, I'll implement in this order: types/constants → DB migration → server fns → goal selector → platform picker → branding panel upgrade → studio tabs → post modal.
