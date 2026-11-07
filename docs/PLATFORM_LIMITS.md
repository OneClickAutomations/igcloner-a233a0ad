# Copy and publishing limit evidence — 2026-11-07

The table is the owner's conservative product contract, not a statement that every network API uses the same ceiling. No limit is silently enlarged based on third-party reports. Opening previews and hashtag ranges are editorial aims, not official hard limits.

| Platform | Product contract | Scope / verification |
|---|---|---|
| Instagram | 2,200; opening 125 | Upload-Post documented caption limit. Official Meta reference retrieved did not independently expose the ceiling; native hashtag changes unverified. |
| TikTok | 2,200; opening aim 150 | Video-compatible product ceiling. Official photo API separately states title 90 and description 4,000 UTF-16 units; not used to enlarge shared copy. |
| X | 280 | Standard-post product ceiling; premium extensions intentionally excluded. Official counting semantics not verified here. |
| Threads | 500 | Official publishing docs. Emoji byte semantics require account/provider confirmation; JS length is not proven equivalent. |
| Bluesky | 300 | Conservative product ceiling; grapheme/byte validation remains unverified in this review. |
| LinkedIn | 3,000; opening aim 210 | Upload-Post documented limit; native API schema retrieved did not independently establish ceiling. |
| Facebook | aim 500 | Editorial only; no fabricated hard platform ceiling. |
| YouTube | title 100; description 5,000 | Product contract. Official resource retrieved defines fields; units/ceiling verification incomplete. |
| Pinterest | title 100; description 500 | Conservative contract; provider character-limit page reports 800, not adopted. Native limit verification incomplete. |
| Reddit | title 300 | Product contract; native verification incomplete. Provider currently documents posting unavailable; don't infer account support from this copy table. |
| Discord | 2,000 | Standard message contract, not embeds/premium message allowance; native reference verification incomplete. |
| Telegram | message 4,096; media caption 1,024 | Official Bot API after entity parsing. Packs use media ceiling. Publishing must distinguish media from standalone text. |

## Sources consulted
- https://docs.upload-post.com/resources/character-limits
- https://docs.upload-post.com/api/upload-photo
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
- https://developers.facebook.com/documentation/threads/reference/publishing
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://developers.google.com/youtube/v3/docs/videos
- https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/
- https://core.telegram.org/bots/api#sendmessage
- https://core.telegram.org/bots/api#sendphoto

Do not treat absence of a retrieved ceiling as proof that a value is wrong or unlimited. Verify provider payload transformation, Unicode counting and connected account before asserting universal API acceptance.