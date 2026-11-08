# Topped-up film proof: bounded narration failure

The owner test film remains private at `/studio/inspiration?projectId=29d394ba-e247-439b-8a51-cfc77b21a710`. Four original clips remain unchanged, 4 seconds each, in order. No retiming, holds, music or new image/video generation.

## Duration rule and observed result

Chris's previous saved sample: 41 words / 10.867 seconds = 3.77289 words/second at speed 1.1. The natural-rate calibration used speed 0.78719, estimated 2.7 words/second, and rounded 95% of the actual summed 16-second scene duration to 41 words. Writing uses the existing streamed Claude copy boundary and validates word count before synthesis. Synthesis uses ElevenLabs character alignment; MP3 frame duration independently checks the audio container. Both speech and audio must fill 90–100% before an assembly input is saved. One timing regeneration is allowed.

Real owner Delivery attempt ec73f44e-c16a-4eb0-81be-1434804f7039:

| Round | Words | Audio | Speech end | ElevenLabs character-cost header |
|---|---:|---:|---:|---:|
| Initial | 41 | 19.48735s | 19.412s | 99 |
| One regeneration | 32 | 12.74776s | 12.678s | 73 |

Both failed coverage. Exact persisted error: `Narration did not fill 90–100% of the film after one regeneration. No assembly input saved.` The first-word-count extrapolation is not a sufficient guarantee because delivery varies with wording. No further paid synthesis was attempted after this bounded failure. A previous script schema-repair output budget of 500 tokens was too small; raised to 2000. Earlier rejected text attempts made no ElevenLabs call.

## Provider usage and film status

- `SHOTSTACK_SANDBOX_API_KEY` readable; documented `GET /edit/stage/templates` returns HTTP 200. This does not verify the topped-up render entitlement or account balance.
- No render submitted after top-up, no completed output/download, no watermark or final caption alignment verified. Shotstack render spend this turn: $0.
- ElevenLabs two synthesis responses report 172 total character units. At the previously observed $22 / 121739 subscription allowance, allocation is about $0.0311, not an exact incremental invoice charge. Account count read after calls: 106840; movement from the prior report's 106572 is +268 and is not isolated to these calls.
- App plan/video credits charged: 0. Owner-proof narration waiver preserved; normal unpriced narration remains blocked.
- 15 focused narration/assembly tests passed; latest harness build OK. Timing rule verified in tests; corrected narration end-to-end failed.

## Product consistency

The stills already differ: scene 1 slender bottle; scene 3 broader body/shoulder and cap; scene 4 slender again. Scene 2 is partly obscured. Sampled clips at 0, 1, 2, 3.8 seconds do not establish zero temporal drift, but the major between-scene mismatch precedes animation. Scenes 2–4 share Omni yet start with different still silhouettes, so mixed models alone cannot explain it. Original attached reference payloads are not recoverable from imported placeholder prompts/asset metadata; no claim that they certainly lacked references.

Production recommendations at verified $0.30/workspace credit:

1. Require a real SKU anchor photo (upload itself $0 generation). Prefer multiple useful product views. Do not treat a generated proxy as exact SKU identity.
2. Generate each scene still from that anchor plus previous approved still for style; anchor outranks style. Still rate remains unmeasured/null: four-still total is `4 × S`, excluding retries; adding reference images' incremental cost must be measured.
3. Add explicit identity verification against anchor before approval; regenerate mismatch once with a stated budget. Cost `4 × V + m × S` for four checks and m replacement stills, where V and S remain unmeasured. Check silhouette, cap/loop, proportions, colors and logo, accounting for perspective/occlusion.
4. Animate only accepted stills with a single selected Fast model and first-frame mode. Four 4-second Fast clips cost $1.92 / 16 video credits, excluding stills/narration/render. Inspect video drift separately.
5. Offer Fast 1–3 ingredient references as a separate 8-second mode, not combined with approved first frame. Four 8-second clips cost $3.84 / 32 video credits and make a 32-second—not faithful 16-second—film. Ingredients improve identity conditioning but do not guarantee exact geometry or correct physics.

Ship anchor + shared-reference stills + verification + approved-first-frame Fast first. Ingredient-only generation is optional, not a blind fix. No evidence stills or clips generated this turn ($0).

## Readiness order

1. Achieve bounded, reliable narration duration; validate audiovisual captions on a real completed private render and download.
2. Product anchor, still identity gate, action/physics and video-drift acceptance tests with representative controlled costs.
3. Measure still, narration and verification costs; configure ordinary video narration debits/refunds and interruption recovery; production render usage/account evidence.
4. Truly separate visual/audio analysis and wire source-grounded storyboard writing.
5. Owner-approved purchase integration (currently intentionally off), balance recovery, mobile/security and customer-level full-flow checks.

Honest verdict: no finished-film verdict is possible. Existing visual assets are an outdoor-themed technical demo with weak product action and inconsistent bottle geometry, not a customer-ready SKU film.