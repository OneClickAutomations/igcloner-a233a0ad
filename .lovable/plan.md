## Goal

Reshape the app so it mirrors the actual workflow: **discover → score → decide → clone → generate video → publish via 3rd-party scheduler**. Replace the URL-only entry point with a multi-source discovery surface, add an objective viral score that drives a Go/Skip recommendation, wire a real video generation provider into the reel pipeline, and integrate Blotato (or similar) for scheduling.

---

## 1. Discovery — `/discover` (new page)

Replace "paste URL only" as the primary entry. Three tabs:

- **Paste URL** — current behavior, kept for power users.
- **Saved creators** — user adds IG handles (`@handle`). For each handle we fetch the last ~12 posts via Apify's Instagram profile actor, rank by engagement, and show a feed of cards. Click a card → goes into the existing analyze flow with that post URL prefilled.
- **Hashtag / keyword** — user enters `#niche` or a keyword. Apify hashtag actor returns top posts. Same card grid → click to analyze.

Each card shows: thumbnail, @handle, likes, comments, views (if reel), and the new **viral score badge**. Cards are deduped across sessions.

New tables:
- `saved_creators (id, user_id, handle, added_at)`
- `discovered_posts (id, user_id, source, source_value, instagram_url, thumbnail_url, owner_username, likes, comments, views, followers, viral_score, scored_at)` — cache so we don't re-scrape on every visit. Cache TTL: 6 hours per (source, source_value).

Apify cost note: each handle scrape ≈ 1 credit, each hashtag scrape ≈ 1–3. Discovery hits will dominate Apify usage — we surface remaining credits and rate-limit to 20 discovery scrapes / user / day.

## 2. Viral score (used on cards AND analysis screen)

Single formula computed server-side, returned with every scraped post:

```text
engagementRate = (likes + comments * 3 + saves * 5) / followers
velocity       = engagementRate / max(hoursSincePosted, 1)    // engagement per hour
reachMultiplier = views ? min(views / followers, 10) : 1       // reels only
baseScore      = log10(velocity * reachMultiplier * 1000) * 25
score          = clamp(round(baseScore), 0, 100)
```

Bands & recommendation shown on the analysis screen:
- 80–100 → "Clone this now" (green, primary CTA enabled)
- 60–79 → "Worth cloning" (amber, primary CTA enabled)
- 40–59 → "Marginal — only if it fits your brand" (neutral, CTA still enabled with a confirm modal)
- 0–39 → "Skip" (CTA disabled by default, override link "Clone anyway")

The score and band are persisted on `analyses.viral_score` and `analyses.viral_band`.

## 3. Analyze screen updates

Above the clone list, add a **Decision Card**: score gauge, band label, top contributing factor ("8.4% engagement, posted 6h ago, 12× views/followers"), and the Go/Skip CTA. The existing clone generation only fires after the user clicks Go (or Override). Removes the current "auto-generate everything" behavior.

## 4. Video generation (reels)

Add real video output to the reel format. Provider abstraction in `src/lib/video.functions.ts`:

```text
generateReelVideo({ cloneId, provider, prompt, aspectRatio: '9:16', durationSec: 8 })
  → returns { videoUrl, jobId, provider, costEstimate }
```

Supported providers behind one interface (user picks per generation, default = whichever has credits):
- **Kling AI** (`kling-v1-pro`, text-to-video, 5s or 10s) — needs `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` (JWT signed).
- **Google Veo 3** via Lovable AI Gateway if available; fallback to direct Veo API if user supplies `VEO_API_KEY`.
- **Runway Gen-3** — needs `RUNWAY_API_KEY`.

User flow on reel format:
1. Click "Generate reel" → modal asks which provider, shows estimated credit cost.
2. We submit job, poll status (Kling/Runway are async, 30s–4min). UI shows progress bar.
3. On completion: store URL in `clones.video_url`, render `<video>` inline with download button.

Storage: Supabase Storage bucket `generated-videos` (new, public read, authed write). Videos pulled from provider and re-hosted so they don't expire.

Required secrets to ask the user for **one at a time, only when they pick that provider**: `KLING_ACCESS_KEY` + `KLING_SECRET_KEY`, `RUNWAY_API_KEY`, `VEO_API_KEY`.

## 5. Publishing — Blotato integration

Replace the "copy & open IG" Post This modal with a real scheduler.

- New page `/schedule` showing connected scheduler + a calendar of queued posts (read from Blotato API).
- "Send to Blotato" button on every generated clone — opens a small modal: caption (prefilled from clone), hashtags, media attachment (image/carousel/video already in our storage), date/time picker (default = next optimal time per Blotato).
- Server fn `scheduleToBlotato({ cloneId, scheduledAt, caption, hashtags })` POSTs to Blotato's `/v1/posts` endpoint, returns the scheduled post id, stores it in new table `scheduled_posts (id, user_id, clone_id, provider, provider_post_id, scheduled_at, status, created_at)`.
- Provider abstraction so SocialPilot, Buffer, Later can be added later — same `scheduleToProvider()` signature.

Required secret: `BLOTATO_API_KEY` — asked when the user first opens `/schedule`.

We do **not** touch Instagram Graph API directly. Blotato handles the OAuth, posting, and Reels upload.

## 6. Dashboard updates

- Add Discover entry to sidebar (top of list, above Analyze).
- Add Schedule entry below Analyze.
- Dashboard history cards already show thumbnail + DNA — add viral score badge and Go/Skip outcome.

## 7. What we are NOT doing in this pass

- No auto-niche detection ("what's my niche?") — user picks handles/hashtags themselves.
- No direct IG Graph API — Blotato/SocialPilot covers it.
- No CapCut/Canva automation — user still finalizes there if they want.

---

## Technical details

**New files:**
- `src/components/DiscoverPage.tsx`, `src/routes/_authenticated/discover.tsx`
- `src/components/SchedulePage.tsx`, `src/routes/_authenticated/schedule.tsx`
- `src/components/ViralScoreBadge.tsx`, `src/components/DecisionCard.tsx`
- `src/components/VideoGenerationModal.tsx`, `src/components/ScheduleModal.tsx`
- `src/lib/discovery.functions.ts` — `addCreator`, `removeCreator`, `listCreators`, `fetchCreatorTopPosts`, `searchHashtag`
- `src/lib/scoring.server.ts` — `computeViralScore(scraped, post)` (pure, unit-testable)
- `src/lib/video.functions.ts` + `src/lib/video-providers/{kling,veo,runway}.server.ts`
- `src/lib/schedule.functions.ts` + `src/lib/schedule-providers/blotato.server.ts`

**Edited files:**
- `src/components/AppPage.tsx` — add Decision Card + Go/Skip gate, add video output rendering, swap Post This → Schedule To Blotato.
- `src/components/AppSidebar.tsx` — add Discover + Schedule nav items.
- `src/components/DashboardPage.tsx` — viral score badge on cards.
- `src/lib/analyze.functions.ts` — compute & persist viral score; stop auto-generating clones until user clicks Go.

**Migrations (one batch):**
- `saved_creators`, `discovered_posts`, `scheduled_posts` tables (all with GRANTs + RLS scoped to `auth.uid()`).
- `analyses.viral_score INT`, `analyses.viral_band TEXT`.
- `clones.video_url TEXT`, `clones.video_provider TEXT`, `clones.video_job_id TEXT`.
- Storage bucket `generated-videos` (public read, authed insert).

**Secrets to add (ask when needed, not upfront):**
- `BLOTATO_API_KEY` — at first visit to /schedule
- `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` — when user picks Kling
- `RUNWAY_API_KEY` — when user picks Runway
- `VEO_API_KEY` — only if Lovable AI Gateway doesn't expose Veo

---

## Suggested build order (3 stages so you can review along the way)

**Stage A — Scoring + Decision Gate (smallest, highest signal):**
Migration for `viral_score` columns + `scoring.server.ts` + Decision Card on AppPage + Go/Skip gate that controls clone generation. Ship & test against a few real URLs.

**Stage B — Discovery:**
`saved_creators` / `discovered_posts` tables, Apify handle + hashtag actors, `/discover` page with three tabs, score badges on cards, sidebar nav item.

**Stage C — Video + Publishing:**
Start with **one** video provider (Kling — best price/quality for reels) and Blotato. Add Veo/Runway/SocialPilot in follow-ups once the wiring is proven.

Confirm the build order (or change it) and tell me which video provider you want first, and I'll start with Stage A.