# Video Inspiration Studio — Step 3 status

## Available today
`/studio/inspiration` is a separate signed-in studio. Create a named film from a saved ready video analysis or a blank storyboard. Upload/toggle/delete global face-anchor, body, back, product and logo references. Edit scene actions, initial objects/states, environment, end state, camera, audio, duration and prompts. Prompts include all listed prerequisites; a conservative object vocabulary rejects omitted motion prerequisites. Approvals are revision-bound and reference changes invalidate them. The checklist is explicit user visual confirmation, not automated computer vision.

Saved observations and transcripts are displayed separately with provenance and unknown fields. The verified import incurred zero additional AI credits; it is **not** a new isolated visual-only/audio-only analysis. Source identity/text is not copied into authored prompts. Regex identity stripping covers tested descriptions but is not a comprehensive identity detector.

The five requested tables are owner-readable/server-written with private media (images ≤10MB, clips ≤50MB). Database tests verified cross-user reads hidden, browser writes denied, concurrent identical claims produce one attempt/one debit, two failure requests produce one refund, and prompt edits invalidate approval. 15 focused unit tests passed. Signed-in storyboard creation/reload and 390px mobile layout passed with no horizontal overflow or page errors. Reference upload, persisted off toggle, and deletion passed.

## Implemented but not live-generated
Quotes, atomic debit/claims, sequential single-active-project jobs, gateway creation/polling, durable IDs, private clip collection, one-time failure refunds, no automatic paid retries. Submitted animation collection is armed hourly only while jobs remain, with up to four jobs per run; tabs poll at 8s. After publishing, a closed-tab result can take up to an hour to save (larger backlogs need subsequent runs). The scheduled route authenticates a database-generated hashed secret, not a public key. No scheduled collector has been live exercised because no new job was created. Ambiguous submissions pause rather than retry/refund blindly. Streamed still saving requires the open tab; interrupted stills are failed/refunded lazily on return after 15 minutes, not recovered as finished images.

Veo cannot combine `image` and `referenceImages`. Current animation uses the approved still as first frame; product references populate that still. This is **not** the requested Fast ingredient-video mode. No silent substitution or false ingredient-mode claim.

## Unavailable/stubbed
Final customer prices and paid generation stay disabled until verified USD/workspace-credit conversion and measured still quote exist. Omni remains visible but input-dependent pricing is unset. AWS assembly detects bridge URL/secret but submission/render collection is a stub. Delivery shows “Assembly not configured yet” and offers a ZIP when completed clips exist; no real generated ZIP was available to verify. Voiceover and AI writing are not wired in this studio; scene writing is deterministic/manual. New isolated-media analysis, automatic pixel prerequisite checks, and comprehensive identity enforcement are outstanding.

## Cost and pricing
**New generation spend: exactly 0 workspace credits; no smoke test run.** No Apify, video, image, writing or ElevenLabs calls were made. A database-only 1-customer-credit test debit was refunded exactly once; net zero customer credits.

Let `r` be the verified USD value of one workspace credit (currently unknown). At $0.145/customer credit and a 35% ceiling: permitted cost/credit = **$0.05075**. For measured cost `W`, customer credits = `ceil(W × r / 0.05075)`.

| Part | Workspace cost basis | Final customer price |
|---|---|---|
| Fast 720p 8s | 8 × 0.4 = 3.2 | unset; ceil(63.054187r) |
| Lite 720p 8s | 8 × 0.2 = 1.6 | unset; ceil(31.527094r) |
| Omni | previous 4s sample 1.62914, input-dependent | unset, not a fixed quote |
| Still | image tokens, input refs and object validation vary; measured quote absent | unset |
| Scene prompt builder | local deterministic/manual, zero AI usage | no debit |
| AI writing / voiceover | not measured/wired here | unset |
| AWS assembly | bridge absent, unmeasured | unset |

At an **illustrative, unverified** r=$0.25, Fast 8s is $0.80 and requires 16 customer credits; Lite is $0.40 and requires 8. These examples are not configured production prices. Existing studio prices are unchanged.

Video-generation and image-generation gateway workflows shaped this implementation; no live model success is claimed.