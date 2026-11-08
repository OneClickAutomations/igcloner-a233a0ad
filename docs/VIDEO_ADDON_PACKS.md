# Video add-on decision — 2026-11-08

## Built and approval status
Video has a separate owner-readable, server-written, append-only ledger. New inspiration animation and assembly claims debit that ledger atomically; persisted billing currency sends historical jobs' refunds back to their original ledger. Refund keys are `kind:entityId:attemptId`, prefixed by debit/refund, and refund amounts come from the original debit, not a caller amount. No balances were converted or seeded. No Stripe or purchase endpoint exists. Approved numbers live in `STUDIO_PRICING`; `video.approved=true` records owner approval, while `video.purchasesEnabled=false` keeps purchases unavailable. Trial 40/$15, Standard 160/$49 and Bulk 400/$109 were approved on 2026-11-08.

Approved Fast rate: 1 unit/second; Lite: 0.5 unit/second, rounded up per action. External renders convert USD cost at $0.12/unit, rounded up. An ordinary 32s Shotstack render is 1 video credit. Still images, writing and analysis remain plan-funded at their existing prices. No nonvideo action price was changed. Unknown rates remain unset.

The app displays both balances, scene quote balance/remaining, a whole-storyboard clip+render budget, and separate plan-cost lines. Insufficient video funds cannot debit plan credits or delete storyboards/stills. “Buy a video pack” opens an honest purchases-unavailable state until approval/payment work. Still images are currently blocked on measurement, not on video funds.

Legacy fal generation and A1 narration/mux are explicitly blocked pending approved video pricing. Existing standalone voiceover behavior is unchanged; narration generated for a reel is blocked pending verified rate. Inspiration narration generation is not implemented; existing audio uploads work without a new generation fee. This is not claimed as a finished paid narration implementation.

## Approved packs — not sold

Verified conversion: $15/50 = $30/100 = $0.30/workspace credit, owner-confirmed 2026-11-08. Fast cost: 0.4 × $0.30 = $0.12/sec. Direct-cost margin = 1 − (units × $0.12)/pack price. Stills/writing/analysis are excluded because they use plan credits; generated narration/render consume video units and must have verified unit quotes.

| Pack | Video credits | Approved price | Price/unit | Maximum Fast-unit cost | Direct margin |
|---|---:|---:|---:|---:|---:|
| Trial | 40 | $15 | $0.375 | $4.80 | 68.00% |
| Standard | 160 | $49 | $0.30625 | $19.20 | 60.82% |
| Bulk | 400 | $109 | $0.27250 | $48.00 | 55.96% |

Recommend Standard as the default. Bulk still leaves ~56% before payment fees, tax, support, failed provider spend and storage/egress. These margins assume all units redeemed at the $0.12 cost basis; they are not net profit. No expiry policy or automatic monthly grants were introduced.

## Full cost/action table

The 35% column is the old plan-credit comparison only: ceil(USD/$0.05075). It is NOT the new video charge. Video margins below use the Standard pack's $0.30625/unit; pack-level margin is the conservative baseline. Unknown means not measured; no invented cost.

| Action | Workspace credits | USD | 35% comparison credits | New balance / approved rate | Direct margin (Standard video / 35% comparison) |
|---|---:|---:|---:|---|---|
| Fast 8s | 3.2 measured | $0.96 | 19 | Video 8 | 60.82% / 65.15% |
| Fast 4s | 1.6 measured | $0.48 | 10 | Video 4 | 60.82% / 66.90% |
| Lite 8s | 1.6 extrapolated | $0.48 | 10 | Video 4 | 60.82% / 66.90% |
| Lite 4s | 0.8 measured | $0.24 | 5 | Video 2 | 60.82% / 66.90% |
| Omni 4s | 1.62914 measured sample | $0.488742 | 10 | Sample equivalent 5; tariff unset/blocked | 68.08% sample / 66.29% |
| Inspiration still image | Unknown | Unknown | Unset | Plan, verified price unset | Unknown |
| Existing A1/Mix/slide image | Unknown incl. retries/review | Unknown | Unknown | Plan 1 unchanged | Unknown |
| Manual storyboard builder | 0 | $0 | 0 | Plan 0 | N/A |
| AI storyboard writing | Unknown/not implemented | Unknown | Unset | Plan, unset | Unknown |
| Cached visual/audio separation | 0 added | $0 added | 0 | Plan 0 | N/A |
| Fresh isolated visual/audio passes | Unknown/not implemented | Unknown | Unset | Plan, unset | Unknown |
| ElevenLabs attached narration 30s | External API, not workspace | Unknown | Unset | Video, unset/blocked | Unknown |
| Existing narration/music upload | 0 new generation | $0 new generation | 0 | No generation debit; render separate | N/A |
| Shotstack ordinary 32s | External API | $0.106667 estimate | 3 | Video 1; sandbox 0 | 65.17% / 75.48% |
| Exact copy | 0 AI | $0 AI | 0 | No generation debit | N/A |
| Post analysis | Complete spend unknown | Unknown | Unknown | Plan 3 unchanged | Unknown |
| Five clone versions | Unknown | Unknown | Unknown | Plan 1 unchanged | Unknown |
| Hook Lab | Token estimates, not measured workspace | Unknown | Unknown | Plan 2 unchanged | Unknown |
| Caption pack | Token estimates, not measured workspace | Unknown | Unknown | Plan 1 unchanged | Unknown |
| Sharpen / text edit | Unknown | Unknown | Unknown | Plan 2 / 2 unchanged | Unknown |
| Carousel/reel/campaign writing and audio strategy | Unknown | Unknown | Unknown | Existing plan behavior unchanged | Unknown |
| Research / ideas / premium / retry / watchlist | Unknown all-in | Unknown | Unknown | Plan 10 / 5 / 20 / 5 / 10 unchanged | Unknown |
| Legacy fal video | Published price, not measured bill | Model-dependent | Historical 15/25 not a quote | Video pending; disabled | Unknown |
| Standalone voice preview/narration | External API, unknown | Unknown | Unknown | Existing behavior unchanged | Unknown |

Historical five-analysis AI average ~$0.10 is an estimate, not a complete measured scrape/transcription cost. Historical failed quality outputs cost estimates ($0.642 hooks/$0.258 captions) are not accepted-output costs or actual workspace deductions. The prior pricing document remains historical; this decision supersedes its video balance/policy.

## Four-scene / 32-second budget

Fast: 4 × 8 = 32 clip units + 1 render unit = **33 video credits**, direct clip+render cost **$3.946667**. Standard pack allocation $10.10625; direct subtotal margin **60.95%**. A 160-unit pack fits four whole such videos (28 units left), before generated narration.

Lite: 4 × 4 = 16 clip units + 1 render = **17 video credits**, direct cost **$2.026667**. Standard allocation $5.20625; direct subtotal margin **61.07%**. A 160-unit pack fits nine whole videos (7 units left), before narration.

Full cost is clip+render subtotal + 4S + W + A + V, where S is per-still USD, W AI writing, A fresh analysis, V narration. Full video-unit total is 33 or 17 + ceil(V/$0.12); plan charges separately cover stills/writing/analysis. Current manual W and cached A are zero; S and V remain unknown, so a full measured total is unavailable. Example quote: “This 32-second video will use 33 of your 160 video credits”; 127 remain. This is no longer taken from the Creator plan's 200 credits.

## Provider recheck and assembly

[Shotstack](https://shotstack.io/pricing/) still shows PAYG $10/50 minutes = $0.20/min, no monthly subscription required. 32s estimate $0.106667; not a measured render. [JSON2Video](https://json2video.com/pricing/) prepaid $49.95/7,200 seconds = $0.41625/min ($0.222/32s); subscription $49.95/12,000 = $0.24975/min. [Creatomate](https://creatomate.com/pricing) $45/2,000 credits, 50 free credits; output-specific metering makes a matched 30fps quote unverified. Full capability matrix and Remotion trade-offs are in HOSTED_VIDEO_ASSEMBLY.md; detailed free-tier/account limits remain unverified without the account test.

Shotstack assembly already submits JSON timelines, polls durable IDs, uses token-verified callbacks, captions/music volume automation/logo/transitions, and saves private portrait MP4s. Missing key keeps it unavailable with clip downloads. No new render submitted: $0. Key and four attached approved clips remain missing. No AWS bridge is needed or built; catalog AWS API can invoke Lambda if revisited.

[fal Veo 3 Fast](https://fal.ai/models/fal-ai/veo3/fast/llms.txt) and [image-to-video](https://fal.ai/models/fal-ai/veo3/fast/image-to-video/llms.txt): $0.15/s with audio, $0.10/s silent. Gateway Fast $0.12/s: 20% cheaper than audio-on fal; silent fal is 16.67% cheaper than gateway. [Kling v2.1 Standard](https://fal.ai/models/fal-ai/kling-video/v2.1/standard/image-to-video/llms.txt): $0.28/5s, $0.056/additional second (5/10s), 53.33% cheaper per second than gateway, not audio/quality-equivalent. Keep gateway Fast for audio product/action; reconsider Kling for a separately approved silent draft quality test. No account or paid test used. Live bills/taxes and all feature equivalence remain unverified.

Owner setup: sign up at dashboard.shotstack.io → API Keys → copy sandbox key → Lovable Project Settings → Secrets: SHOTSTACK_SANDBOX_API_KEY. Production later uses SHOTSTACK_API_KEY and removal of sandbox key. Do not paste keys in chat.

## Verification
46 focused unit tests pass. Actual migration-created ledger and claim functions passed isolated PostgreSQL rollback tests for duplicate grants/debits, insufficient balance, attempt-scoped single refunds, plan-ledger isolation, append-only grants, owner reads and cross-user denial. Concurrent identical debit/competing balance tests run in a disposable PostgreSQL database, not customer accounts. Hosted privileged execution of these tests is unavailable through the read-only sandbox DB role; schema/claim definitions were independently read back from the hosted database. Signed-in desktop/390px checks show both balances, saved storyboard, unavailable pack purchases and missing-key assembly, no horizontal overflow. No paid generation performed; spend $0.
## Real-app proof attempt — 2026-11-08
Readable secret: `SHOTSTACK_SANDBOX_API_KEY`. Documented `GET /edit/stage/templates` returned HTTP 200 and `success:true`; no render was submitted. An initial unsupported GET to `/render` returned 404, not a credential failure.

Signed-in owner opened `/studio/inspiration`, selected the available Studio verification film, entered Delivery and clicked Quote assembly. The real flow rejected it with **Every scene needs an approved, completed clip.** The film has one 8-second draft scene and zero completed clips, not the requested four eligible scenes. Stopped there, without manufacturing approved attempts or using a script-only render.

No finished MP4; render time not applicable; Shotstack render spend $0, ElevenLabs spend $0 (not called), new video-credit charge 0. Caption/audio alignment, coherence, identity, motion and pacing cannot be judged without output. Narration generation and automatic speech-aligned captions are not wired into this studio; uploads/manual SRT are implemented. Music upload and interval ducking exist but remain unverified with a real render.

Next prerequisite: attach the four original paid test clips to a project through an owner-authorized import with honest source provenance and revision eligibility, not fabricated still approvals. Then wire measured video-ledger narration and speech-aligned captions, supply licensed music, and repeat the actual Delivery flow. Independent visual/audio passes, AI storyboard writing, measured still pricing, real callback/collection recovery and production output QA remain open. Purchases intentionally remain off.
