# Roadmap

## Pass 2 — film review
- [x] Review player/shot strip, priced regeneration with saved history/snapshots, free completed-version switching, audio choices and private review drafts, Publish placeholder
- [x] Signed-in desktop/390px light/dark, quotes without generation, version switching and save/resume verified; 19 focused tests
- [ ] Paid regeneration, Claude script/narration and new assembly output — intentionally unverified; no paid generation authorized for this pass

## Topped-up Shotstack completion and quality — current
- [x] Add measured-rate duration word target, MP3 frame/speech coverage gate and one timing regeneration; 15 focused tests pass
- [ ] Corrected narration proof — Delivery produced 19.487s/41 words then 12.748s/32 words at Chris speed 0.787; bounded timing check failed. Needs more reliable duration control; no further synthesis in this turn
- [ ] Submit/poll/save/download faithful film — waiting on narration passing its timing gate; Shotstack templates check HTTP 200, no render submitted after top-up
- [x] Diagnose product mismatch: inconsistent still silhouettes predate video; mixed models not causal proof; no evidence stills regenerated. Report reference/verification options with known/unknown costs

## Authorized imported-film proof — 2026-11-08
- [x] Locate four original Phase 1 clips/stills; ffprobe confirms each clip has 4.000s video, 720×1280; history confirms original proof was four ~4s scenes
- [x] Offline owner-only import with provenance into TEST DEMO — Summit Bottle — Phase 1 (16s), ID 29d394ba-e247-439b-8a51-cfc77b21a710; four original clips/stills, no new generation or import charge
- [ ] Production ElevenLabs narration pricing/debits — atomic claim/refund scaffold and owner-proof-only generation exist; proof waived to 0 video credits, normal paid narration remains blocked/unpriced; stale-attempt recovery remains
- [x] Generate 41-word outdoor bottle narration using Chris / eleven_multilingual_v2; no music; synthesis character timestamps produce nine captions. Actual speech/audio 10.867s, shorter than ideal 16s pacing; not retimed
- [ ] Finished-film proof — two real signed-in app submissions rejected HTTP 403 by Shotstack: sandbox requires at least 1 account credit, account has 0.00. Owner must restore account entitlement at https://dashboard.shotstack.io/subscription; no provider job IDs/output, polling/save/download/watermark/alignment not verified
- [x] Measure/report: Shotstack no accepted render, $0 quoted/charged in app; 0 plan/video credits, ledger empty. ElevenLabs count moved 106479→106572 (+93, delayed/approximate), ~$0.0168 allocated at $22/121739 allowance, not exact invoice cost; 26 focused tests pass

## Owner approvals and real assembly proof — 2026-11-08
- [x] Lock approved Trial 40/$15, Standard 160/$49, Bulk 400/$109; Fast 1/sec, Lite 0.5/sec; purchases remain disabled
- [x] Confirm readable SHOTSTACK_SANDBOX_API_KEY and verify documented templates GET returns HTTP 200
- [ ] Complete four-clip narrated assembly — stopped in owner Delivery → Quote assembly: “Every scene needs an approved, completed clip.” Available film has one draft scene / zero completed clips; import/attach existing test media and wire narration/alignment first
- [x] Document exact real-app blocker; no render, no ElevenLabs call, $0 provider spend / 0 new video credits; output quality unverified

## Separate video add-on balance — owner decision 2026-11-08
- [x] Separate append-only ledger, atomic scene/render debit and attempt-bound currency-safe refunds
- [x] Dual balances, proposed quotes and insufficient-balance recovery; no live prices or purchases
- [x] Guard unapproved legacy video/attached narration; proposed pack math and complete known/unknown cost table
- [x] Ledger isolation/concurrency/refund tests and signed-in desktop/mobile verification
- [x] Provider research recheck; Shotstack retained, gateway audio-on Fast still cheaper than fal
- [ ] Activate purchases — payment integration intentionally excluded; pack/rate approval now recorded
- [ ] Measured still/voiceover/isolated-pass full totals — provider measurements missing; no spend authorized
- [ ] Attached narration and legacy fal paid video metering — measured rates/wiring missing; safely blocked
- [ ] Free four-clip assembly test — sandbox key verified; four eligible attached clips missing

## Verified pricing — 2026-11-08
- [x] Record owner-verified $0.30 conversion and central cost-ceiling configuration; enable known-rate generation quotes without changing existing prices/plans
- [x] Measured/unknown action audit, 32s Fast/Lite subtotals, margin options and current fal comparison; full totals blocked on still/voiceover measurements
- [x] Monthly-allowance quote context, 38 price/approval/assembly/credit tests and signed-in Fast/Lite quotes; no generation spend
- [ ] Assembly follow-up: key verified; four eligible attached clips still missing; no render spend
- [ ] Complete measured action pricing — blocked: no still/voiceover/fresh isolated-analysis measurements; no provider spend authorized
- [x] Record owner approval of video add-on packs and Fast/Lite rates; sales remain disabled

## Pass 5A — motion then assembly (current request)
- [x] Replace AWS/Remotion plan with hosted renderer research: recommend Shotstack, published $0.20/min PAYG; no render spend
- [x] Hosted assembly timeline, quote/debit/refund, durable submission/poll/private result, delivery controls and tests; provider-backed completion blocked on key
- [ ] One free-tier four-clip assembly test — blocked: existing test clips are not attached to a studio project; sandbox key verified
- [x] Controlled pouring matrix: five clips, 10.42914 workspace credits; frame review finds no fully realistic pass
- [x] Save best provisional motion template with focused tests; no existing screens or prices changed
- [x] Confirm deployed assembly limits and document exact AWS bridge/setup/cost
- [ ] Assemble existing four clips with voiceover/captions — blocked: four eligible attached clips missing, narration/alignment not wired; sandbox key verified
- [x] Step 3: studio tables/RLS, reference library, cached observation separation, editable storyboard/approval
- [x] Step 3: quotes, atomic sequential attempts, gateway create/poll/private collection and refunds implemented
- [x] Step 3: hosted assembly unavailable state, completed-clip ZIP fallback, generation pricing unset; assembly quoted separately
- [x] Step 3: 15 unit tests; live cross-user/duplicate debit/refund/approval checks; signed-in desktop/mobile and reference upload/delete
- [ ] Step 3: paid still→animation smoke and measured output recovery — blocked: verified USD conversion/still quote unset; no paid generation performed
- [ ] Step 3: independent visual-only/audio-only re-analysis, automatic pixel object checks, writing/voiceover generation — not implemented; cached evidence and explicit user checklist only
- [x] Step 3: hosted assembly submission/collection replaces the retired AWS bridge; research/setup documented in docs/HOSTED_VIDEO_ASSEMBLY.md
- [ ] Step 3: Fast product-ingredient animation mode — conflicts with approved first-frame mode; gateway disallows both in one job

## Pass 5A — Video Inspiration Studio feasibility and plan
- [ ] Live gateway capabilities and per-call recorded costs; no fal.ai calls
- [ ] Four-scene saved-blueprint proof: new subject reference, four approved stills, four 720p portrait clips
- [ ] Assembly and split visual/audio analysis design; full feature plan, pricing and risks
- [ ] Final evidence report and preview links; no existing screens or prices changed

## Pass 4 — shared writing engine and quality
- [x] Mandatory per-output gate for Hook Lab, packs, carousel/reel core copy and Sharpen; bounded regeneration, task-aware critic, real saved exemplars
- [ ] Quality acceptance: latest hooks 7.66/min5 and NASA pack 8.07/min7; four prompt-development configurations exhausted without a pass
- [ ] Four-round score table, full five-analysis/two-niche old/new eval and full raw samples
- [ ] Hook Lab prompt/output compaction below $0.10 target without changing prices
- [ ] Shared grounded Claude copy engine, schemas, repair and quality rubric
- [ ] Ranked Hook Lab, native caption packs, Sharpen and writing-model consolidation
- [ ] Platform limits verified against official documentation
- [ ] Carousel continuity and text verification; decide quick-generate shortcut
- [ ] Tests, repeatable old/new evaluation and requested live checks
- [ ] Model inventory, measured costs and final report with raw samples
- [ ] Deterministic carousel exact-text fallback and repeat four-slide live test
- [x] Mocked attempt-refund/cache tests and mobile Clone Studio check (390px, no horizontal overflow)
- [ ] Auto-shorten integration, all generic writing quality gates, studio mobile/results checks
- [x] Remove unused settings Anthropic validation; no direct key source references
- [x] Model inventory and current failed-run token/cost observations (unknown actions explicitly null)

## Content Creation Pass 2 — real analysis (done)
- [x] Staged analysis job with stages, heartbeat, sweep + attempt refund
- [x] Slide evidence (Claude vision), video shot list (Gemini video input), ElevenLabs transcript
- [x] Claude synthesis with zod + one repair; blueprint, provenance, confidence, limitations
- [x] Studios compatible; source-context prefers blueprint
- [x] Result screen: hook, caption structure, slides, shot timeline, transcript, provenance

## Pass 3 — copy modes + rights (done)
- [x] A0–A3 labels/order; Research category unchanged
- [x] Rights confirmation table + server enforcement + Terms line
- [x] A0 exact copy (byte-identical) → publish draft
- [x] A1 slide text replace with verification gate + refunds; caption rewrite
- [x] A1 video: voiceover over original (on-screen text not editable)
- [x] Mix images panel; video credits with refunds

## Open
- [ ] fal.ai work and source-video text-replacement tests paused by owner; gateway-first inspiration feasibility replaces this investigation
- [ ] A2/A3 carousel continuity/text gate implemented; browser exact-text fallback implemented but four-slide live recheck outstanding
- [ ] Facebook multi-photo posts: capture path unverified (pass 1 open item)
- [ ] Analysis jobs only advance while a tab is open; truly unattended runs need a scheduled background worker (owner decision)

## Pass 2 fix pass (done)
- [x] Versions on demand (1 credit, cached); analysis ≈ $0.10 / ≈ 50s of AI time on the 5 saved posts
- [x] Accuracy re-checks + slide/timestamp post-check + limitation dedupe
- [x] Unfinished analyses hidden or labelled in lists/counts; project creation refuses them
- [x] Resume after closing the tab (stage-per-request)
- [x] Large videos: SD copy for Facebook, else transcript + cover with a labelled limitation
- [x] Instagram reel with speech verified once
