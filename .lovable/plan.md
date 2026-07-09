# Content Intelligence Engine Upgrade

This is a large, multi-phase build. I'll extend the existing app without removing anything. To keep it shippable, I'm proposing 4 phases you can approve in order — each phase is usable on its own.

## Architecture (shared foundation)

A new **Content Intelligence Engine** — a single structured data model that Research, Campaign Planner, Analyze, Studio, and Publishing all read from. No module reruns AI when existing intelligence already answers the question.

New tables (backend):
- `research_reports` — Content DNA reports (niche / competitor / topic), scraped raw data + AI-structured analysis
- `content_ideas` — 50-ideas engine output, linked to a research report, scored (virality, difficulty, competition, business value, audience interest, production time, confidence)
- `campaigns` — a 30-day plan with goal, business type, audience, platforms, content mix, linked `research_report_id`
- `campaign_items` — each day's content object; supersedes/extends `calendar_items` (kept for back-compat, migrated)
- `competitor_watchlist` — saved competitors for Dashboard widget

Reuses existing: `analyses`, `projects`, `publishing_jobs`, `social_accounts`, Apify token, Lovable AI Gateway.

## Phase 1 — Research Module + Sidebar/Dashboard (foundation)

**Sidebar reorder:** Dashboard → **Research** → Projects → **Campaign Planner** (renamed from Calendar) → Analyze → Settings.

**Dashboard additions:**
- New "Research" card (Discover what content your audience actually wants → Start Research)
- "Recent Research" list
- "Trending Opportunities" (top-scored ideas from user's reports)
- "Competitor Watchlist"
- "Saved Research"

**New route `/research`** with 3 modes:
1. By Niche (preset list: Fitness, Real Estate, Automotive, etc.)
2. By Competitor (IG username/brand)
3. By Topic (freeform)

**Apify integration** (server function using existing `APIFY_TOKEN`):
- Runs Instagram scraper actor → posts, reels, carousels, captions, hashtags, cadence, engagement, comments
- Stores raw payload in `research_reports.raw_data`
- Second pass via Lovable AI (`openai/gpt-5.5`) produces structured **Content DNA Report**: Executive Summary, Audience Profile, Content Pillars, Top Topics, Hooks, Caption Structure, Thumbnail Patterns, Visual Style, Posting Frequency/Times, Engagement Trends, Most Shared/Saved, CTAs, Brand Voice, Storytelling, Growth Opps, Weaknesses, Missed Opps, Competitive Advantages, Opportunity Score

**Content Opportunity Engine:** button on report → generates 50 ranked ideas → stored in `content_ideas` → each has "Save to Campaign Planner" action.

## Phase 2 — Campaign Planner (rename + wizard + generation)

- Rename Calendar → **Campaign Planner** (route stays `/calendar`, add `/campaigns` alias)
- **Campaign Wizard** (6 steps): Goal → Business Type → Audience → Platforms → Content Mix (% sliders) → Use Research (pick existing report to auto-populate)
- **Generate 30-day campaign** via AI using the research report as grounding — creates 30 `campaign_items`
- Each day = editable project with: Title, Idea, Objective, Audience, Hook, CTA, Platform recs, Content Type, Status, Priority, Publishing rec, AI Notes, Confidence

## Phase 3 — Daily Content Object + Campaign Views

- Per-day action bar: Generate Script / Carousel / Reel / Image / Thumbnail / Voice / Captions / Hashtags / Publishing Copy / Schedule / Publish / Duplicate / Archive / Delete (wires into existing Studio + Publishing server functions)
- **Views:** Calendar, Kanban, List, Agenda, Pipeline, Week, Month (tab switcher on Campaign Planner)
- **AI Content Director** panel per item: Rewrite / More Viral / More Professional / More Emotional / More Educational / Luxury / Short / Long / Alternatives (single `directContent` server fn with variant enum)

## Phase 4 — Scheduling Center + Progress Tracking

- Enhanced scheduling per item: Immediate / Schedule / Recurring / Platform selection / Timezone / Optimal time / Approval workflow
- Status pipeline: Draft → Queued → Scheduled → Publishing → Published → Failed → Retry (reuses `publishing_jobs`)
- **Campaign Dashboard widget**: Planned / Scripts / Reels / Scheduled / Published counters + completion % + upcoming queue
- Platform-specific caption variations (reuses existing platform-copy server fn)

## Technical Details

- All AI calls go through `src/lib/ai-gateway.server.ts` with `openai/gpt-5.5`
- All Apify + AI work in `createServerFn` under `_authenticated` — user-scoped, RLS-enforced
- Every new `public` table gets: `GRANT` to authenticated + service_role, RLS enabled, owner-scoped policies (`auth.uid() = user_id`)
- Research report reuse: Campaign wizard/Studio/Analyze accept a `research_report_id` and skip re-analysis
- Zero removals: existing Calendar, Analyze, Projects, Studio, Publishing all keep working; new layer sits alongside and links in

## Recommendation

Approve **Phase 1** first. It's the foundation everything else reuses. I'll implement it end-to-end (schema + Apify scraper + Content DNA + Opportunity Engine + Research route + Dashboard widgets + sidebar) in one turn, then we iterate through phases 2–4.

**Reply "go" to start Phase 1, or tell me to adjust scope / re-order phases.**
