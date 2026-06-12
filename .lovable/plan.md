Findings so far:
- `APIFY_TOKEN` is configured as a backend secret.
- The current analysis function reads `process.env.APIFY_TOKEN` and calls APIfy directly.
- Recent server logs show APIfy scraping is succeeding: `[analyze] scrape ok { owner: 'world._.motivation' }`.
- That means the APIfy key is present and working for the tested Instagram URL in preview; the remaining failure is likely later in the analysis response/AI/persistence path, not APIfy.

Plan:
1. Add an authenticated `checkApifyConfig` server function that performs a minimal live APIfy request against a known/public Instagram URL or a user-provided URL.
2. Return a safe diagnostic response only: `{ ok, present, status, itemCount, sampleOwner, error }`; never expose the token.
3. Add temporary frontend logging or a small debug action/page so you can trigger the check yourself and see the exact result in the browser console.
4. Keep `checkConfig` for secret presence, but enhance it to include APIfy token prefix/length only if needed for debugging without exposing the full secret.
5. Validate by running the check endpoint and comparing:
   - `present: true`
   - APIfy HTTP `status: 200` or successful item count
   - `itemCount > 0`
   - `sampleOwner` populated for a public post

How you can validate my response after implementation:
- Open the app, trigger the APIfy check, and inspect browser console logs for the returned diagnostic object.
- Re-run an analysis and confirm server logs contain `[analyze] scrape ok` before any later error.
- If the diagnostic returns `ok: true`, APIfy is working; if analysis still fails, we should focus on the Claude/JSON/persistence portion next.