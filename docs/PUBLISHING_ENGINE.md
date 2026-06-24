# IGCloner Publishing Engine (Upload-Post)

Multi-tenant social publishing built on the [Upload-Post](https://upload-post.com)
API. Every IGCloner user maps 1:1 to an Upload-Post **profile** whose
`username` is the user's Supabase `auth.users.id`. We never store platform
OAuth tokens — Upload-Post owns all OAuth and token storage. We persist only
connection **status**, selector choices (FB Page / LinkedIn Org / Pinterest
Board), job/result state, and cached analytics.

## Architecture

This app uses **TanStack Start server functions** (`createServerFn` with the
`requireSupabaseAuth` middleware), not Supabase Edge Functions. The Upload-Post
spec's "edge functions" are implemented here as:

| Spec edge function              | Implementation                                              |
| ------------------------------- | ---------------------------------------------------------- |
| `upload-post-create-profile`    | `createUploadPostProfile` in `src/lib/upload-post.functions.ts` |
| `upload-post-generate-connect-url` | `generateConnectUrl` (same file)                        |
| `upload-post-sync-accounts`     | `syncAccounts` (same file)                                 |
| `fetch-platform-selectors`      | `fetchPlatformSelectors` / `setPlatformSelector`           |
| `publish-content`               | `publishContent` in `src/lib/publishing.functions.ts`      |
| `poll-publishing-status`        | `pollPublishingStatus` (same file)                         |
| `fetch-analytics`               | `fetchAnalytics` in `src/lib/analytics.functions.ts`       |
| `upload-post-webhook`           | Public route `src/routes/api/public/upload-post-webhook.ts` |

All outbound Upload-Post HTTP goes through the single client in
`src/lib/upload-post/api.server.ts` (auth header, timeouts, error
normalization). Client-safe rules (capability matrix, error copy, platform
metadata) live in `src/lib/upload-post/shared.ts` and are imported by both the
UI and server validation so they never drift.

### Security model

- `UPLOAD_POST_API_KEY` is read only via `process.env` inside server functions;
  it never reaches the browser and never appears in any response.
- `upload_post_username` is always derived server-side from `auth.uid()`. It is
  never accepted from the client.
- `publishing_results`, `analytics_snapshots`, `post_analytics`,
  `webhook_events` are **service-role write only** — clients have `SELECT`
  (or no access, for `webhook_events`). RLS is enabled on every table.
- The webhook verifies an HMAC-SHA256 signature when
  `UPLOAD_POST_WEBHOOK_SECRET` is set, and always returns `200` to avoid
  provider retry storms. Idempotency is enforced via `webhook_events`.
- Selector IDs (FB Page / Board / Org) are cross-checked against the provider's
  own list for that user before being saved.

## Environment variables

```
UPLOAD_POST_API_KEY          # Required to enable publishing (app.upload-post.com)
UPLOAD_POST_WEBHOOK_SECRET   # Required only if Upload-Post signs webhooks
SITE_URL                     # Public origin for connect redirect + logo, no trailing slash
```

When `UPLOAD_POST_API_KEY` is unset, the UI degrades gracefully with a
`PROVIDER_NOT_CONFIGURED` message instead of crashing.

## Webhook

Point the Upload-Post webhook at:

```
POST https://<your-site>/api/public/upload-post-webhook
```

## Field-name reconciliation

The `docs.upload-post.com/openapi.json` spec was unreachable from the build
network, so request/response field parsing in `api.server.ts` is defensive: it
accepts multiple known key shapes (`request_id`/`requestId`, `access_url`/
`accessUrl`, `social_accounts` map vs `accounts` array, etc.). If you have
access to the live OpenAPI spec, reconcile field names in **`api.server.ts`
only** — handlers and UI never hardcode Upload-Post field names.

## Database

See `supabase/migrations/20260624040000_upload_post_publishing_engine.sql` for
the full schema: `upload_post_profiles`, `social_accounts`, `publishing_jobs`,
`publishing_results`, `analytics_snapshots`, `post_analytics`, `webhook_events`.
