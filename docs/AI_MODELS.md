# AI model inventory — 2026-11-07

Costs are measured only where stated; unknown is not zero. User credits differ from Lovable workspace credits and estimated USD. Writing quality retries currently make costs exceed the target; action prices were not changed.

| File / functions | Model / provider | Purpose | Measured estimate / action price |
|---|---|---|---|
| copy-engine.server.ts: copyText/copyJson/qualityCopyJson/hookLab/nativeCaptionPack | anthropic/claude-sonnet-5, Lovable native streamed Messages | Shared writing, validation/repair, separate ranking and quality critic | Latest failed hooks: $0.642 / 2 credits refunded when metered; failed four-platform pack $0.258 / 1 refunded when metered |
| copy.functions.ts: runHookLab/generateCaptionPack | Shared engine | Hook/pack cache, ownership, billing | Cached quality-version repeats 0; failed attempts refunded |
| analyze.functions.ts: makeItBetter, multiply, clone preferences, calendar writing | Shared engine | Sharpen and other writing | Sharpen 2 credits; current successful cost unmeasured |
| carousel.functions.ts: generateCarousel/regenerateSlide | Shared engine + mandatory quality gate | Carousel copy | Current successful cost unmeasured; no new price introduced |
| reel.functions.ts: generateReel, prompt package, regeneration | Shared engine; script has mandatory gate | Reel writing and visual directions | Current successful cost unmeasured; copy price unchanged |
| image.functions.ts: generateImageCaption; platform-copy.functions.ts | Shared nativeCaptionPack | Studio caption consumers | Included A1/image caption does not add second debit |
| clone-ai.server.ts: rewriteSlideTexts/rewriteCaptionLikeSource/rewriteVoiceoverScript | Shared engine | Slide words, included caption, voiceover copy | Unmeasured; caption gated; remaining generic rewrites need expanded gate coverage |
| angles.functions.ts, campaigns.functions.ts, enhance.functions.ts | Shared engine | Angles, campaigns, enhancement | Unmeasured; generic copy calls are not all quality-gated yet |
| analysis-ai.server.ts: claudeCall; analysis-pipeline.server.ts | anthropic/claude-sonnet-5, Lovable streamed Messages | Image vision and evidence synthesis | Prior saved-five analysis ≈$0.10 estimate; analysis action 3 credits |
| analysis-ai.server.ts: video observation | google/gemini-3.8-flash, Lovable | Actual saved-video observation only | Unmeasured in this continuation |
| analysis-ai.server.ts: transcribeAudio | ElevenLabs scribe_v2 | Speech transcription | Dollar cost unknown; included in analysis |
| intel-ai.server.ts: generateIntelJson; research.functions.ts | anthropic/claude-sonnet-5, Lovable streamed Messages | Research interpretation / ideas | Current measured cost unknown; report 10, ideas 5 credits |
| clone-ai.server.ts: verifyEditedSlide | analysis Claude boundary | OCR/residual/composition QA, not copy generation | Unmeasured per verification |
| image-edit.server.ts: editImageWithRefs | openai/gpt-image-2, Lovable image edits | A1 exact-aspect edit and multi-reference Mix | 1 credit/slide or Mix; provider cost unmeasured |
| carousel-image.functions.ts: generateCarouselSlideImage | google/gemini-2.5-flash-image, Lovable; shared Claude prompt enhancement | A2/A3 images with continuity; final text-free background for browser overlay | 1 credit, failed render refunded; final free overlay OCR check |
| image.functions.ts: generateProjectImage | google/gemini-2.5-flash-image, Lovable | New image | 1 credit; provider cost unmeasured |
| analyze.functions.ts: legacy text edit | google/gemini-2.5-flash-image-preview, Lovable | Generated asset edit | textEdit 2 credits; unmeasured |
| video.functions.ts: submitVideo/pollVideo | fal-ai/veo3/fast, fal-ai/veo3, fal-ai/kling-video/v2.1/standard (text/image-to-video variants) | Video generation | 15/25 credits; prior fal account block not re-probed |
| voiceover.functions.ts: TTS / mux | ElevenLabs configured model; fal mux | Narration and source-video audio assembly | Cost unmeasured; prior mux block remains |
| settings.functions.ts: validateKey | No Anthropic call | Direct Anthropic key validation removed | No generation call; secret retained |

`ANTHROPIC_API_KEY` has no source references and no direct api.anthropic.com request remains. Legacy stored user-key metadata is retained; saving/testing Anthropic keys now reports that they are unused. Other service-key checks remain unchanged. This inventory does not establish activity or billing for unused code paths.