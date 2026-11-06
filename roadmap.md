# Roadmap — Content Creation Pass 1 (scrape + ingest + credits)

- [ ] A) URL classification: IG /p/ (image vs carousel from data), /reel(s)/, /tv/; FB reel/watch/videos vs posts/permalink/photo/story; share-link + fb.watch redirect resolution (5 hops, 5s, strip tracking params); final types Image|Carousel|Reel|Video|Post
- [ ] B) Scraper routing: user Apify key else platform token; IG scraper full capture (childPosts, videoUrl, musicInfo, etc.); FB reels via apify~facebook-reels-scraper (verify schema + 1 live test); FB posts via facebook-posts-scraper captionText:true; wrong-post rejection; specific human errors
- [ ] C) Normalized source package: mediaItems[], primaryVideoUrl, durationSec, transcript, audio, scrapeCoverage; carousel up to 20 slides
- [ ] D) Persist media to private bucket source-media/{userId}/{analysisId}/ (video 100MB, img 15MB, 25s, concurrency 4); storedMedia[] in scraped_data; RLS own-folder; getSourceMediaSignedUrls helper; failures noted not fatal
- [ ] E) Analysis credits: 3/analysis, 12h same-URL cache = 0; config adds textEdit 2, videoGeneration 15/25, imageGeneration 1, hookLab 2, captionPack 1; retire analyses_used/limit gate (leave columns); UI cost + balance
- [ ] F) Refund fix: attempt-scoped ids (attempt_id col on credit_ledger, pending_attempt_id/pending_charge_amount on research_reports, RPC + sweep update); wire research report/retry/ideas + analysis; tests
- [ ] G) UI: type chip, cost label, "What we captured" strip, insufficient-credits state
- [ ] H) Unit tests (classification, normalization, wrong-post, refund-per-attempt) + live verification: IG image, IG carousel, IG reel, FB reel, FB post (1 run each)
