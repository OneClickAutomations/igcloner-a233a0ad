# Roadmap

## Pass 4 — shared writing engine and quality
- [ ] Mandatory per-output >=9 average / >=8 dimension gate, task-aware critic, grounded exemplars, bounded regeneration
- [ ] Four-round score table, full five-analysis/two-niche old/new eval and full raw samples
- [ ] Hook Lab prompt/output compaction below $0.10 target without changing prices
- [ ] Shared grounded Claude copy engine, schemas, repair and quality rubric
- [ ] Ranked Hook Lab, native caption packs, Sharpen and writing-model consolidation
- [ ] Platform limits verified against official documentation
- [ ] Carousel continuity and text verification; decide quick-generate shortcut
- [ ] Tests, repeatable old/new evaluation and requested live checks
- [ ] Model inventory, measured costs and final report with raw samples
- [ ] Deterministic carousel exact-text fallback and repeat four-slide live test
- [ ] Auto-shorten/refund/cache integration tests, all caption consumers, mobile check
- [ ] Remove unused settings Anthropic validation; confirm direct key usage

## Content Creation Pass 2 — real analysis (done)
- [x] Staged analysis job with stages, heartbeat, sweep + attempt refund
- [x] Slide evidence (Claude vision), video shot list (Gemini video input), ElevenLabs transcript
- [x] Claude synthesis with zod + one repair; blueprint, provenance, confidence, limitations
- [x] Studios compatible; source-context prefers blueprint
- [x] Result screen: hook, caption structure, slides, shot timeline, transcript, provenance

## Pass 3 — copy modes + rights (done)
- [x] A0–A3 labels/order; Research category unchanged
- [x] Rights confirmation table + server enforcement + Terms line
- [x] A0 exact copy (byte-identical) → publish draft
- [x] A1 slide text replace with verification gate + refunds; caption rewrite
- [x] A1 video: voiceover over original (on-screen text not editable)
- [x] Mix images panel; video credits with refunds

## Open
- [ ] Video service (fal.ai) balance exhausted: blocks video text-edit test, voiceover mux, and all Veo/Kling video generation until topped up
- [ ] A2/A3 carousel per-slide continuity references + text gate (not built this pass)
- [ ] Facebook multi-photo posts: capture path unverified (pass 1 open item)
- [ ] Analysis jobs only advance while a tab is open; truly unattended runs need a scheduled background worker (owner decision)

## Pass 2 fix pass (done)
- [x] Versions on demand (1 credit, cached); analysis ≈ $0.10 / ≈ 50s of AI time on the 5 saved posts
- [x] Accuracy re-checks + slide/timestamp post-check + limitation dedupe
- [x] Unfinished analyses hidden or labelled in lists/counts; project creation refuses them
- [x] Resume after closing the tab (stage-per-request)
- [x] Large videos: SD copy for Facebook, else transcript + cover with a labelled limitation
- [x] Instagram reel with speech verified once
