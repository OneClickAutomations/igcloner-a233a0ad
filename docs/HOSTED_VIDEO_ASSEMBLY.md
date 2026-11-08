# Hosted video assembly — checked 8 November 2026

**Video add-on update:** assembly now uses the separate video ledger; proposed 32s render charge is 1 video credit (sandbox 0), not 3 plan credits. Pack approval gates paid renders. See [VIDEO_ADDON_PACKS.md](./VIDEO_ADDON_PACKS.md). Provider cost remains an estimate, not a measured render.

## Recommendation: Shotstack

Its JSON timeline covers our ordered clips, supplied ElevenLabs audio, timed captions, music, timed logo and fades. API-key authentication, async job IDs, status polling and output URLs require no owner infrastructure. PAYG is $10 minimum top-up for 50 minutes ($0.20/minute), without a monthly subscription.

**32-second estimate:** 32 / 60 × $0.20 = **$0.106667**. Layers do not add timeline duration. This is a pricing estimate, not a measured render. Customer assembly credits = ceil(0.106667 / ($0.145 × 0.35)) = **3**. Successful clips are not debited again. Workspace-credit conversion is now owner-verified at $0.30; see [VERIFIED_STUDIO_PRICING.md](./VERIFIED_STUDIO_PRICING.md). Still and voiceover measurements remain unknown.

## Provider comparison

Prices below were read from providers' own pages on the date above. Monthly package averages assume the whole allowance is used; minimum purchases are not the cost of a single render.

| Provider | Render pricing / minimum | Free testing | Resolution |
|---|---|---|---|
| [Shotstack](https://shotstack.io/pricing/) | PAYG $0.20/min, $10 top-up. Monthly $39/250 min ($0.156/min), $99/750 ($0.132/min), $199/2,000 ($0.0995/min), $499/10,000 ($0.0499/min) | 10 signup credits, 30 days; free sandbox. Free preview output limited to 480px; exact sandbox limits require account verification | PAYG/Starter up to 1080p; Pro+ 4K; portrait supported |
| [JSON2Video](https://json2video.com/pricing/) | 1 credit/second. Prepaid $49.95/7,200 credits = $0.41625/min; monthly $49.95/12,000 = $0.24975/min, $99.95/30,000 = $0.1999/min | 600 credits, no card; watermarked | 4K documented; no extra resolution-credit multiplier; 9:16 |
| [Creatomate](https://creatomate.com/pricing) | Essential $45/month/2,000 credits; Growth $108/10,000; Beyond $274/50,000. 30s 720p portrait at 25fps = 6.91 credits, Essential package average ≈$0.311/min; actual rate depends on pixels/fps | 50 credits, no card; previews up to 480px | Full-quality paid outputs; exact maximum not verified in this review |
| [Cloudinary](https://cloudinary.com/pricing) | Pooled transformations/storage/bandwidth credits, not a simple rendered-minute tariff; comparable 32s cost unknown | 25 monthly credits | Transformation-dependent; exact applicable portrait ceiling unverified |

| Capability | Shotstack | JSON2Video | Creatomate | Cloudinary |
|---|---|---|---|---|
| JSON composition + 9:16 + MP4 concatenation | Yes | Yes | JSON composition/9:16 yes; exact concat recipe not fully verified | Concat transformations yes; not an equivalent JSON timeline |
| External narration/audio | Yes | Yes | Yes | Audio layers yes |
| Burned captions | SRT/VTT and rich captions | SRT/VTT/ASS | Timed subtitles yes; direct SRT import unverified | SRT workflow unverified |
| Music ducking | Manual volume automation; automatic speech-aware ducking unverified | Unverified | Manual volume/fades; automatic ducking unverified | Unverified |
| Timed image/logo and transitions | Yes | Yes | Yes | Layers yes; transition equivalence unverified |
| API key, no OAuth | Yes, x-api-key | Yes, x-api-key | Yes, bearer API key | API key/secret signed requests |
| Async submit/status/result URL | Yes | Yes; output retention 7 days | Yes; retention 30 days | Async transformation exists; equivalent polling workflow unverified |

JSON2Video 32s prepaid package-average estimate: **$0.2220**. Creatomate 32s 720p/25fps estimate: **7.3707 credits / $0.1658** at Essential package average (not our 30fps output and not measured). Cloudinary cannot be fairly priced with the evidence gathered. No better matched low-commitment renderer was verified.

## Remotion trade-off

Earlier illustrative Lambda compute: 2 GB × 60–300 aggregate execution seconds × $0.0000166667/GB-second = **$0.002–$0.010**, excluding storage, transfer, request charges, orchestration and any Remotion license. Shotstack's $0.1067 estimate is roughly 11–53× that compute-only illustration, not a measured apples-to-apples total. We gain hosted operations and a simple browser setup; lose arbitrary source-controlled React compositions, renderer/account control and custom composition flexibility. Media is temporarily processed by a third-party service. No AWS resources were built.

**For the record:** Lovable's AWS API connector can invoke Lambda directly. If Remotion returns, a custom bridge is not required for invocation, although a deployed composition and properly scoped AWS setup would still be needed.

## Built behavior

- Approved, revision-matched clips are assembled in scene order; source audio muted; 720×1280/30fps MP4 requested.
- Optional uploaded narration/music/logo (10MB each), SRT captions, logo timing and cut/fade controls.
- Quote and explicit confirmation precede atomic debit. One active project job and idempotency protect duplicate submissions.
- Durable provider IDs; callback verifies a per-job token and then polls Shotstack rather than trusting supplied status/output URLs. Signed-in delivery polling and reopen recovery collect already submitted work, never recreate paid renders.
- MP4 bytes saved privately, limited to 50MB; finished video shown with download. Provider render failures refund assembly once, not clips. Temporary collection failures remain retryable without rerendering. Unknown submission response blocks automatic paid retry and requires provider-history reconciliation.
- Missing keys leave assembly disabled with download-all-clips fallback. No recurring server poller was added.
- Both `SHOTSTACK_API_KEY` (production) and `SHOTSTACK_SANDBOX_API_KEY` (test) are supported; sandbox takes precedence while configured. Remove sandbox key to switch to paid production. Sandbox limits/watermark need live account validation.

## Owner browser setup

1. Sign up at [Shotstack](https://dashboard.shotstack.io/).
2. Open the dashboard's API Keys area and copy the **sandbox/test** key first.
3. In Lovable **Project Settings → Secrets**, add `SHOTSTACK_SANDBOX_API_KEY` with that value. Do not paste it into chat.
4. For production later, add `SHOTSTACK_API_KEY` using the production key and remove the sandbox secret; buy PAYG minutes if required.

## Verification and blockers

22 targeted assembly/studio tests passed; signed-in desktop and 390px delivery checks showed disabled quote with missing key, no horizontal overflow and no runtime errors. Database assembly fields and conditional interrupted-claim refunds applied. Paid/free render execution and provider-backed refund/finished-video recovery remain **unverified**: no Shotstack key exists and the available studio project has one scene / zero completed clips, not four attached approved clips. No render submitted: **new render cost exactly $0, zero customer render credits**. The requested one free-tier four-clip test remains blocked on those two prerequisites. Actual encoded portrait dimensions and provider callback ID payload still require live verification. If both submission response and callback are lost, history reconciliation is manual; no reconciliation control is exposed in the app yet.

## Official technical sources
- https://shotstack.io/docs/api/
- https://shotstack.io/docs/guide/architecting-an-application/callbacks/
- https://json2video.com/docs/v2/api-reference/
- https://creatomate.com/docs/api/introduction
- https://creatomate.com/docs/account/how-are-credits-calculated
- https://cloudinary.com/documentation/video_manipulation_and_delivery
- https://aws.amazon.com/lambda/pricing/
- https://www.remotion.dev/docs/lambda/estimateprice