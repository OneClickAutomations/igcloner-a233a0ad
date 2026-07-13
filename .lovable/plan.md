
# IGCloner — Full MVP Launch Plan

Goal: get the app to a state where you can hand invite links to beta testers without embarrassing gaps. You picked **Full MVP** (reel stitch + billing included).

## Current state (verified)

- Admin route works but **no user has `role = 'admin'`**. 2 users, 68 analyses, 40 projects, 1 research report, 8 connected social accounts, **0 campaigns, 0 publishing jobs**.
- All 8 recent AI Gateway calls returned 200 (Gemini 2.5 Flash / 2.5 Flash Image / 3 Flash Preview). Secrets for ElevenLabs, Fal, Apify, Upload-Post, Anthropic, Lovable AI, encryption all present.
- No `StudioComingSoon` in use — Reel, Carousel, Image, Voiceover studios all wired to real routes.
- **No ffmpeg / final-render code exists** — Reel Studio still produces audio + visuals as separate assets.
- No Stripe/Paddle checkout wired. `analyses_limit` exists on `profiles` but nothing enforces it or upgrades users.

## Phase 1 — Instant unblocks (same session)

1. **Promote admin.** Update `profiles.role = 'admin'` for `streetlitmagazine@gmail.com`.
2. **End-to-end smoke test.** Log in as admin, run: Research → generate a campaign → open a day → generate a reel → publish to a connected IG account via Upload-Post. Fix anything that throws.
3. **Migrate to `has_role` pattern.** Move admin check off `profiles.role` into a `user_roles` table + `has_role()` security-definer function (current pattern is the flagged privilege-escalation shape). Update `_authenticated/admin.tsx` gate accordingly.

## Phase 2 — Reel final render (ffmpeg on the worker is a no-go)

Cloudflare Workers can't run ffmpeg. Two viable paths:

- **A. Fal.ai video/audio composition endpoints** (already have `FAL_KEY`). Cleanest — no infra.
- **B. Delegate stitch to a lightweight Modal/Replicate/Render worker** we call from a server function; store the mp4 in the `project-assets` bucket.

Recommend **A**. Deliverables:
- `src/lib/reel-compose.functions.ts` — takes clip URLs + voiceover + music + captions timing → returns final mp4 URL.
- "Render final video" button in Reel Studio after audio step; shows progress, saves to `project_assets`.
- Download + "Send to Publishing" actions on the finished mp4.

## Phase 3 — Billing (Stripe seamless)

1. Run `recommend_payment_provider` → likely Stripe seamless (SaaS + digital).
2. `enable_stripe_payments` with tax calc only default.
3. Products: Free (10 analyses), Creator ($19 / 100), Pro ($49 / unlimited-ish, e.g. 1000).
4. Webhook → update `profiles.plan` + `analyses_limit`.
5. **Enforce limits server-side** in `analyze.functions.ts`, `research.functions.ts`, `reel.functions.ts`, `carousel.functions.ts`, `image.functions.ts`, `voiceover.functions.ts`. Currently unenforced — beta users can burn unlimited AI credits.
6. Billing UI already exists in `settings/BillingSection.tsx`; wire the "Upgrade" buttons to Stripe checkout.

## Phase 4 — Beta gating

Options (pick one):
- **Invite-code table** — user signs up with a code, blocks otherwise.
- **Allowlist email** on `profiles.role IN ('beta','admin')`.
- **Public with waitlist form** on landing, manual approve in admin.

Also: `analyses_limit` default should drop to a beta-friendly number (e.g. 20).

## Phase 5 — Legal + trust

- `/terms` and `/privacy` routes with real copy (Instagram TOS + data collection language required by Upload-Post + Apify).
- Auth page footer links to both.
- Cookie/consent banner (light — no analytics yet means minimal).

## Phase 6 — Ops + monitoring

- **Error capture**: `src/lib/error-capture.ts` exists — verify it's actually reporting somewhere (Sentry / Lovable). Add server-side capture in every `.functions.ts` catch block.
- **Admin panel additions**: recent errors, recent publishing job failures, per-user credit usage chart.
- **Health page** `/api/public/health` — 200 if DB + Lovable AI + Upload-Post reachable.
- **Uptime ping** via cron.

## Phase 7 — Onboarding polish

Not blockers, but big for beta perception:
- First-run wizard: connect Upload-Post → connect first social → generate first research report (auto-open Research after signup).
- The Launch Checklist widget already handles this — verify all 7 items detect correctly after phases 2–3 land.

## Technical notes

- Reel stitch: `sharp` / `ffmpeg` / `puppeteer` are all blocked on Workers per server-runtime constraints — must use external service.
- Move `admin` check to `user_roles` + `has_role()` before shipping (linter will flag current pattern).
- Every new public table needs GRANTs + RLS in the same migration.
- Publishing throttling: `UPLOAD_POST_API_KEY` is per-user now (good), but add rate-limit backoff in `publishing.functions.ts`.

## Suggested execution order

Phase 1 → Phase 3 (billing before beta invites, so users can't nuke credits) → Phase 5 (legal) → Phase 4 (gating flip) → **soft launch first cohort of 5–10 testers** → Phase 2 (reel render, users can produce assets in meantime) → Phase 6 → Phase 7.

Approve and I'll start with Phase 1 (admin promotion + smoke test).
