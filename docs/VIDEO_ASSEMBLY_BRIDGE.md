# Pass 5A: motion and assembly, 8 November 2026

> Historical investigation only. The owner retired AWS/Remotion assembly. Current implementation and setup are in [HOSTED_VIDEO_ASSEMBLY.md](./HOSTED_VIDEO_ASSEMBLY.md); do not follow the bridge checklist below.

## Motion evidence
Five calls cost exactly 10.42914 workspace credits, excluding chat/build. All outputs are 720×1280 with audio tracks (sound quality not listened to). Elapsed create/poll/download times: Fast 4s 58.55s; Fast 8s 58.71s; Fast ingredients 8s 42.42s; Lite 4s 50.49s; Omni 4s 51.19s.

Ranking: Fast ingredients 8s is the strongest action candidate: cap removal, visible pouring, visible cup fill and bottle returned upright. However a second water stream appears from the cap: physical realism fails. Fast start-frame 8s pours but its opaque bottle becomes transparent. Fast 4s pours with the cap apparently attached and does not return the bottle. Lite 4s tilts with the cap attached; no clearly visible water stream. Omni 4s pours into the backpack pocket rather than a separate cup. None is production-approved. These are single stochastic samples, not model success rates. The start frame contains no cup and has the bottle inside a backpack; future still approval should verify action prerequisites, including a visible empty cup and usable open bottle. No additional generation authorized by this test.

Product/action recommendation: Fast ingredients 8s, provisional only, with a reference-only scene, one action, explicit normal speed, one camera instruction and measurable final state. Product consistency is broad, not exact. Talking/UGC is untested; Fast 8s with user-owned identity references is a candidate, not a validated recommendation. Spoken-line timing and lip-sync need their own approved test.

Exact call evidence (UTC):
- Fast 4s: 1.6 credits; 03:37:14; log 01a1b93b-4be9-78d7-bab3-f9f6ad25b177.
- Fast 8s: 3.2 credits; 03:38:12; log 01a1b93c-30a5-762e-8a28-3367fac1e12d.
- Fast ingredients 8s: 3.2 credits; 03:39:11; log 01a1b93d-15f8-7df6-8840-2d43aeb5888f.
- Lite 4s: 0.8 credits; 03:39:53; log 01a1b93d-bba2-7204-8e17-6d32642f7d89.
- Omni 4s: 1.62914 credits; 03:40:44; log 01a1b93e-80dc-7a2d-ba8e-2ed54ac275af.

## Assembly decision
The build sandbox has ffmpeg. The deployed app does not support subprocesses; native ffmpeg cannot run there. Browser ffmpeg.wasm is a different deployment, not an established app-server equivalent; there is no configured WASM renderer. A hypothetical custom edge WASM port is not proven feasible for H.264 encoding plus captions/voiceover under memory/CPU/bundle limits. Do not install one as an assumed fix. Use the owner's existing Remotion Lambda via an AWS-side authenticated HTTP bridge. No bridge URL/secret, region, function or serve URL is configured in this project, so assembly is blocked. No ElevenLabs audio was generated and no stitched output was made. A local sandbox stitch would not prove the native app assembly path.

## Browser/Chromebook owner checklist
1. In AWS Console select the region used by the existing Remotion product. Record its function name, Remotion version, site/serve URL and S3 bucket. Reuse resources only if compatible and authorized for this app.
2. Open AWS CloudShell from the console. Use the existing product's Remotion source and matching package version; add a composition `VideoInspiration` accepting clips, audio, captions, music and logo. Deploy that site using the official Remotion CLI. Console-only configuration cannot create this composition: its source must be supplied by the owner or implemented in a later approved task.
3. Create a separate Node.js bridge Lambda and API Gateway HTTP API in that region. Package the matching `@remotion/lambda` client in CloudShell or the existing deployment pipeline. Use an AWS IAM execution role rather than copying access keys to this app.
4. Grant the bridge permission to invoke the specific Remotion function, read/write only the relevant Remotion/job S3 prefixes and write logs. Use Remotion's version-specific policy generators for renderer permissions; separate deployment permissions from runtime permissions. The renderer needs its own `remotion-lambda-role` and documented policy. Keep S3 private and block public access. Avoid wildcard runtime administration grants.
5. Configure bridge environment: `REMOTION_REGION`, `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`, `REMOTION_BUCKET_NAME`, `BRIDGE_SECRET`. Store a random secret securely; enable HTTPS, request limits and a throttled API. Never put it in browser code or query strings.
6. Add only `REMOTION_BRIDGE_URL` and the same `REMOTION_BRIDGE_SECRET` in this app's Project Settings → Secrets. The app will authenticate users, validate ownership and submit from a server function. Owner AWS setup plus bridge/composition implementation is required before a test render.

## Proposed exact HTTP bridge contract (not deployed)
`POST /v1/renders`, header `Authorization: Bearer <bridge-secret>`, content type JSON. Reject missing/invalid auth before any paid call. Validate strict schema, URL allowlist and duration/file limits; never accept arbitrary composition/serve URL/function from callers. Persist idempotency in DynamoDB with conditional writes. Render IDs must be scoped to the owning app user and job. Media URLs must be signed private URLs valid long enough for download; do not log their query strings. Prefer bridge downloads to a private job prefix with allowlisted sources and byte limits, to avoid renderer fetching arbitrary URLs.

Example body:
```json
{
  "idempotencyKey": "project-uuid:assembly-attempt-uuid",
  "ownerId": "user-uuid",
  "projectId": "project-uuid",
  "clips": [
    {"url": "<signed-private-clip-url>", "durationSeconds": 4},
    {"url": "<signed-private-clip-url>", "durationSeconds": 4.032},
    {"url": "<signed-private-clip-url>", "durationSeconds": 4.032},
    {"url": "<signed-private-clip-url>", "durationSeconds": 4.032}
  ],
  "voiceover": {"url": "<signed-private-mp3-url>"},
  "captions": [{"startSeconds": 0, "endSeconds": 2, "text": "Approved narration"}],
  "music": null,
  "logo": null,
  "output": {"width": 720, "height": 1280, "fps": 30, "codec": "h264"}
}
```
Response 202: `{"jobId":"assembly-uuid","status":"queued","estimatedComputeUsd":null}`. Duplicate idempotency keys return the same job; conflicting bodies return 409. Invalid schema returns 400; unauthorized 401; oversized input 413; throttled 429. No automatic resubmission.

Bridge invokes `renderMediaOnLambda({region,functionName,serveUrl,composition:'VideoInspiration',codec:'h264',inputProps,privacy:'private'})`, persists returned `renderId` and `bucketName`, and uses `getRenderProgress({region,functionName,renderId,bucketName})` on status reads. Composition concatenates clips using fixed frame rounding at 30fps, mutes original audio by default, adds the approved ElevenLabs narration, timed burned captions, optional licensed music and logo. Expose audio choice; mixed source sound is not assumed to be suitable music.

`GET /v1/renders/{jobId}` requires the same authorization plus verified owner scoping. Return `{"jobId":"...","status":"rendering","progress":0.5}` or `{"jobId":"...","status":"completed","outputUrl":"<private-signed-output>","expiresAt":"<UTC>","durationSeconds":16.1,"computeUsd":null}`. Failure: `{"jobId":"...","status":"failed","error":{"code":"render_failed","message":"safe reason"}}`. The app saves completed bytes in its own private storage; signed output is not the permanent database location. Actual duration depends on frame rounding. Refund only the failed assembly attempt, not successful scene generations.

## Cost and pricing
No render was run, so per-render cost is unmeasured. Illustrative standard US x86 Lambda compute: $0.0000166667 per GB-second. At 2 GB × 60–300 aggregate execution seconds = $0.002–$0.010; aggregate includes all parallel functions, not wall time. Add invocation fees, bridge/DynamoDB, S3, transfer, excess ephemeral disk and any Remotion license. Region/architecture rates differ. Use `estimatePrice()` and measured progress billing after a real render; it excludes S3 and license. ElevenLabs narration is separate and not measured in this step.

No final customer prices set. Let `r` = verified USD/workspace credit (unknown). At $0.145/customer credit and 35% generation-cost ceiling, customer credits/second = workspace credits/second × r / 0.05075. Lite 0.2/s → 3.94089r; Fast 0.4/s → 7.88177r; Omni this call 0.407285/s → 8.02532r. Fast ingredient 8s scene → 63.0542r customer credits before stills/writing/audio/render. At illustrative, unverified r=$0.25: Fast ≈1.97044 customer credits/s; no production price follows from this assumption.

## Official references
- https://www.remotion.dev/docs/lambda/setup
- https://www.remotion.dev/docs/lambda/permissions
- https://www.remotion.dev/docs/lambda/rendermediaonlambda
- https://www.remotion.dev/docs/lambda/getrenderprogress
- https://www.remotion.dev/docs/lambda/estimateprice
- https://www.remotion.dev/docs/miscellaneous/render-on-edge
- https://www.remotion.dev/docs/license/faq
- https://aws.amazon.com/lambda/pricing/