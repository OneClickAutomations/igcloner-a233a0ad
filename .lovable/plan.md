## Root cause

- APIfy and Anthropic keys are valid. Server logs confirm scrape success and `[analyze] done` with an analysis ID.
- Client receives `undefined` ~45s after invocation. That is a dropped HTTP response, not an API failure — the handler runs **two** sequential Claude `sonnet-4-5` calls (4k + 6k tokens). Combined latency exceeds the dev/edge HTTP timeout window, so the connection closes before the response body is flushed even though the handler finished.
- Returning `undefined` to the client then bypasses every error-handling branch we added, so the UI shows the generic "AI request failed" message.

## Fix strategy: tear down the slow path, rebuild lean

1. **Replace the two-Claude-call chain with one fast call via Lovable AI Gateway** using `google/gemini-3-flash-preview`. Single structured-output call returns DNA + 5 clones in one response, typically 5–12s instead of 30–50s. No Anthropic key needed (Lovable AI is already provisioned and billed via workspace credits).
2. **Keep APIfy** for Instagram scraping — it works.
3. **Use AI SDK structured output (Zod schema)** so the response is guaranteed-shaped JSON — eliminates the "malformed JSON" retry path.
4. **Hard 25-second timeout** on the AI call with `AbortController`. If exceeded, return a real error shape, never undefined.
5. **Always return a JSON-serializable shape** from the server function, even on thrown errors — wrap the entire handler body so the client always gets `{ ok, error, data }`.
6. **Keep Anthropic-backed helpers (`makeItBetter`, `generateHooks`, `multiplyContent`) untouched** — they're single short calls and aren't part of the broken path. They'll keep using your Anthropic key.
7. **Remove the diagnostic panel** from /admin once the new path is verified (keeps admin clean).

## What I'll change

- `src/lib/analyze.functions.ts` — rewrite `analyzeInstagramPost`:
  - One Lovable AI Gateway call with combined system+user prompt and a Zod schema covering DNA fields + clones array.
  - 25s AbortController timeout.
  - Try/catch around everything, always returning `{ ok, limitReached, error, data }`.
  - Keep the usage gate, profile read, DB persistence, and clone insert exactly as today.
- `src/lib/ai-gateway.server.ts` (new) — shared Lovable AI provider helper.
- `package.json` — add `ai`, `@ai-sdk/openai-compatible`, `zod` (zod already present).
- `src/components/AppPage.tsx` — no logic change; existing `result?.ok === false` / `result?.data` handling already covers the new shape.
- `src/components/AdminPage.tsx` — leave diagnostics for now; remove later once stable.

## Why this will work

- Total request time drops well under any dev/edge HTTP timeout → no more dropped responses → no more `undefined`.
- Structured output removes the JSON-parse failure class entirely.
- Errors that do happen are surfaced as a typed result, so the UI shows the real message instead of "AI request failed".
- Lovable AI Gateway is already wired into your workspace; no key to add, no rotation needed.

## Validation steps after build

1. Run an analysis on the same Instagram URL that was failing.
2. Browser console should show `[analyze] server fn response { ok: true, data: { analysisId, dna, clones } }` within ~10s.
3. Results view should render with 5 clone versions.
4. If APIfy is slow on a particular URL, the fallback branch still runs and you get DNA+clones based on URL+postType alone.