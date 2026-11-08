# Verified studio pricing — 2026-11-08

Owner-confirmed receipts: $15/50 and $30/100 Lovable workspace credits, both **$0.30/credit**. Customer credit = **$0.145**. Proposed 35% cost ceiling: `ceil(cost / 0.05075)`. Direct-cost gross margin = `1 − cost / (customer credits × 0.145)`; excludes fees, tax, overhead, failures and refunds.

Conversion and video policy are recorded in `src/lib/studio-pricing.ts`. Known-rate Fast/Lite animation is now quoteable/confirmable after still approval; it still requires sufficient balance and configured AI access. Stills and Omni remain blocked on unknown action quotes. Existing studio prices and plans are unchanged. No generation was run in this request.

## Evidence-backed table

| Action | Workspace credits | USD cost | Proposed customer credits, 35% | Direct margin | Evidence |
|---|---:|---:|---:|---:|---|
| Fast 8s | 3.2 | $0.96 | 19 | 65.15% | Measured prior call |
| Fast 4s | 1.6 | $0.48 | 10 | 66.90% | Measured prior call |
| Lite 8s | 1.6 | $0.48 | 10 | 66.90% | Rate extrapolated from measured 4s, NOT separate measurement |
| Lite 4s | 0.8 | $0.24 | 5 | 66.90% | Measured prior call |
| Omni 4s | 1.62914 | $0.488742 | 10 | 66.29% | Measured sample, not universal tariff |
| Inspiration still | Unknown | Unknown | Unset | Unknown | No measured Sunburst portrait/edit sample |
| Current storyboard prompt builder | 0 | $0 | 0 | N/A | Local/manual, no AI writing call |
| AI storyboard writing call | Unknown | Unknown | Unset | Unknown | Not implemented |
| Cached visual/audio separation | 0 added | $0 added | 0 | N/A | Reuses saved observations/transcripts |
| Fresh isolated visual pass | Unknown | Unknown | Unset | Unknown | Not implemented/measured |
| Fresh isolated audio pass | Unknown | Unknown | Unset | Unknown | Not implemented/measured |
| ElevenLabs narration / 30s | Unknown | Unknown | Unset | Unknown | Duration cannot establish character/model/account-specific cost |
| Uploaded existing narration/music | 0 new generation | $0 new generation | 0 extra generation | N/A | Render cost separate |
| Shotstack / 32s | External USD, not workspace credits | $0.106667 | 3 | 75.48% | Published PAYG estimate, not measured render |
| A0 exact copy | 0 AI | $0 AI | 0 | N/A | Saved-byte copy, storage/egress excluded |

Measured video call references are in `docs/VIDEO_ASSEMBLY_BRIDGE.md`, historical motion evidence. Source references do not imply a new run.

## Existing studio action audit — prices unchanged

| Actions | Underlying measured workspace spend | Existing customer charge | Proposed 35% price/margin |
|---|---|---|---|
| Post analysis | Unknown per current run; historical five-post AI average ≈$0.10 was an estimate | 3 | Unknown (scrape/transcription also unknown) |
| Five clone versions | Unknown | 1 | Unknown |
| Hook Lab | Tokens recorded, provider spend unmeasured | 2 | See illustrative estimates below, not accepted-price recommendation |
| Caption packs | Tokens recorded, provider spend unmeasured | 1 | See illustrative estimates below |
| Sharpen / text edit | Unknown | 2 / 2 | Unknown |
| A1 image edit / Mix / A2-A3 slide image | Unknown including verification/retries | 1 per slide/operation | Unknown |
| Standalone new-image handler | Unknown | Config says 1; handler has no debit | Unknown; material unmetered path |
| Existing fal Veo Fast / Veo or Kling | Unknown measured provider bill | 15 / 25 | Published quotes below are not actual measurements |
| Carousel/reel writing, regenerations, angles, campaigns, enhancement, audio strategy | Unknown | No explicit debit in reviewed handlers | Unknown; workspace calls may still cost money |
| Voice preview / scene narration | Unknown | No explicit debit in reviewed handlers | Unknown; ElevenLabs is not free because unmetered |
| Research / ideas / premium / retry / watchlist | Unknown complete provider cost | 10 / 5 / 20 / 5 / 10 | Unknown |
| Same-user cache hit | No new provider generation on reused path | 0 | N/A |

Historical writing **USD estimates** based on recorded tokens, not measured workspace deductions: baseline hooks $0.117213 → proposed 3 credits / 73.05%; failed quality hooks $0.642030 → 13 / 65.94%; failed quality captions $0.258432 → 6 / 70.30%. These runs failed acceptance and were withheld/refunded where metered; no accepted-output cost established. At unchanged nominal charges, quality-run cost/revenue would be hooks **−121.39%** and captions **−78.23%**, before refunds. Historical `workspaceCreditsEstimate` fields use an old token tariff, not the owner receipt conversion; they must not be relabeled measured or multiplied by $0.30 as though exact charges.

## 4-scene, 32-second total

Let `S` = per-still measured USD, `W` = AI writing USD, `V` = voiceover USD, `A` = fresh isolated analysis USD.

- **Fast:** clips $3.84 + render $0.106667 + 4S + W + V + A. Known subtotal **$3.946667**. Whole-bundle rounding is **78** credits; current per-action rounding is **4×19 + 3 = 79**, before unknown extras.
- **Lite:** clips $1.92 + render $0.106667 + 4S + W + V + A. Known subtotal **$2.026667**. Whole-bundle rounding is **40** credits; per-action rounding is **4×10 + 3 = 43**, before unknown extras.
- Current local writing/cached reuse adds W=A=0, but generated stills and voiceover are unknown. A full measured total cannot honestly be supplied. Uploaded existing stills/audio do not prove generated versions cost zero.

**Creator economics to surface:** $29/200 = $0.145/credit. Fast clips alone take **76** separately rounded credits, revenue equivalent $11.02; $3.84 cost / $11.02 = 34.85% (65.15% margin). 200/76 = **2.63 videos/month**, before extras. With render at 79 credits: **2.53/month**, and only **two whole videos** fit in 200 credits. Still/voiceover charges reduce that further.

## Three choices — proposals only

Compare the same **clips + render** subtotal $3.946667, excluding unknown extras:

| Choice | Proposed pricing | Direct margin | Consequence |
|---|---|---:|---|
| A: Keep 35% ceiling | 78 whole-bundle credits; current separate actions 79 | 65.10% bundle / 65.55% separate | Expensive video; 200/79 = 2.53 equivalents, two whole videos |
| B: Video-only 50% ceiling | 55 whole-bundle credits | 50.51% | About 3.64 equivalents, three whole videos; less margin for retries/support |
| B: Video-only 60% ceiling | 46 whole-bundle credits | 40.83% | About 4.35 equivalents, four whole videos; thinner margin |
| C: Separate add-on pack | Illustrative $24 for two Fast clip+render videos | 67.11% before still/audio/fees | Protects plan credits; $24 is NOT a final offer and must rise if extras exceed the budget |

**Recommend C**, separate video add-on packs priced after measuring still/voiceover and a failure allowance. Keeps the Creator writing/research allowance useful while giving video an explicit budget. No plan, existing action price, add-on or alternative ceiling was changed. The active video quote remains 35%.

## Current fal comparison — official sources checked today

- [Veo 3 Fast](https://fal.ai/models/fal-ai/veo3/fast/llms.txt) and [Veo 3.1 Fast](https://fal.ai/models/fal-ai/veo3.1/fast/llms.txt): 720p/1080p $0.10/s without audio, **$0.15/s with audio**; 4/6/8s. Gateway measured 720p Fast audio tariff 0.4×$0.30 = **$0.12/s**, 20% cheaper than fal audio-on. An 8s clip is gateway $0.96 versus fal $1.20. Audio-off fal $0.80/8s is cheaper but not feature-equivalent. Named fal text-to-video prices do not verify first-frame/ingredient endpoint equivalence.
- [Kling v2.1 Standard](https://fal.ai/models/fal-ai/kling-video/v2.1/standard/image-to-video/llms.txt): $0.28/5s, $0.056 per extra second; 5 or 10s. No native generated-audio price verified. [Pro](https://fal.ai/models/fal-ai/kling-video/v2.1/pro/image-to-video/llms.txt): $0.49/5s, $0.098 extra/s. Standard exact resolution unverified; Pro up to 1080p.
- Kling Standard is substantially cheaper per silent second, but different duration, action fidelity, identity and audio behavior require a quality test before switching. No test/switch authorized here. Keep gateway Fast for current audio product scenes; reconsider fal/Kling as a separately approved silent-draft option, not proven equivalent.

## Assembly follow-up

Shotstack remains recommended; official [pricing](https://shotstack.io/pricing/) reconfirmed $10/50 minutes. Ordinary stage rendering is free/watermarked, **AI elements are charged even in stage**, and at least one active credit is needed: [staging FAQ](https://help.shotstack.io/en/articles/14050795-staging-environments-faqs). Our timeline uses existing media, not provider AI elements. Key and four approved attached clips still missing; free test and actual MP4 recovery remain unverified. No provider spend this turn. Owner setup and implementation remain documented in `docs/HOSTED_VIDEO_ASSEMBLY.md`.