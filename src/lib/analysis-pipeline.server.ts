// Staged post analysis: slide evidence (Claude vision) → video shot list
// (Gemini video input) + transcript (scraper or ElevenLabs) → Claude
// synthesis → blueprint. Loads media from the private source-media bucket,
// never from expiring CDN links (old analyses fall back and are labelled).
import { MEDIUM_CATEGORIES_PROMPT } from "@/lib/medium";
import {
  DATA_RULE, SlideBatchSchema, SynthesisSchema, VideoEvidenceSchema, buildBlueprint, computePerformance,
  deriveLimitations, normalizeForensics, parseWithRepair, tryParseJson, wrapData,
  type SlideEvidence, type StoredMediaRef, type TranscriptSegment, type VideoEvidence,
} from "@/lib/analysis-evidence";
import {
  CLAUDE_ANALYSIS_MODEL, VIDEO_OBSERVATION_MODEL, claudeCall, geminiVideoCall, toBase64, transcribeAudio,
  type ClaudeBlock, type Usage,
} from "@/lib/analysis-ai.server";

export type AnalysisStage = "fetching_post" | "saving_media" | "reading_slides" | "watching_video" | "transcribing" | "building_blueprint";

const MAX_SLIDES = 20;
const SLIDE_BATCH = 7;
const VIDEO_INLINE_MAX = 40 * 1024 * 1024;

async function loadStoredBytes(path: string, image: boolean): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("source-media");
  if (image) {
    // Downscale longest side to ~1568px JPEG q85 via storage image transforms.
    const t = await bucket.download(path, { transform: { width: 1568, height: 1568, resize: "contain", quality: 85, format: "origin" } });
    if (t.data) return { bytes: new Uint8Array(await t.data.arrayBuffer()), mime: t.data.type || "image/jpeg" };
  }
  const { data } = await bucket.download(path);
  if (!data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || (image ? "image/jpeg" : "video/mp4") };
}

async function loadCdnImage(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, { headers: { Referer: /fbcdn|facebook/i.test(url) ? "https://www.facebook.com/" : "https://www.instagram.com/" } });
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !mime.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength > 0 && buf.byteLength < 5 * 1024 * 1024 ? { bytes: new Uint8Array(buf), mime } : null;
  } catch { return null; }
}

function legacyCdnImageUrls(scraped: any): string[] {
  const urls: string[] = [];
  for (const m of scraped?.mediaItems ?? []) if (m.kind === "image" && m.url) urls.push(m.url);
  if (urls.length === 0) for (const u of [scraped?.displayUrl, ...(scraped?.childPosts ?? []).map((c: any) => c?.displayUrl)]) if (u) urls.push(u);
  return urls.slice(0, MAX_SLIDES);
}

const SLIDE_SYSTEM = `You are an OCR-grade visual evidence extractor for social posts. Describe only what is literally visible. ${DATA_RULE}
Return ONLY JSON: {"slides":[{"index":number,"exactText":string (verbatim, keep line breaks as \\n and original capitalization; "" if none),"textBlocks":[{"text":string,"vertical":"top"|"center"|"bottom","horizontal":"left"|"center"|"right","sizeRel":"small"|"medium"|"large"|"dominant","weight":"light"|"regular"|"bold"|"black","case":"upper"|"lower"|"title"|"sentence"|"mixed","fontStyle":"serif"|"sans"|"script"|"display"|"mono","handwritten":boolean,"colorHex":"#RRGGBB","backgroundHex":"#RRGGBB"|null}],"palette":["#RRGGBB"],"backgroundHex":"#RRGGBB"|null,"subjects":string[],"composition":string,"cameraAngle":string,"lighting":string,"props":string[],"overlays":string[] (stickers, logos, watermarks, @handles),"medium":string}]}
${MEDIUM_CATEGORIES_PROMPT}`;

async function readSlides(images: { bytes: Uint8Array; mime: string }[], usages: Usage[]): Promise<SlideEvidence[]> {
  const out: SlideEvidence[] = [];
  for (let b = 0; b < images.length; b += SLIDE_BATCH) {
    const batch = images.slice(b, b + SLIDE_BATCH);
    const content: ClaudeBlock[] = [];
    batch.forEach((img, i) => {
      content.push({ type: "text", text: `Slide index ${b + i}:` });
      content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: toBase64(img.bytes) } });
    });
    content.push({ type: "text", text: `Extract evidence for the ${batch.length} slide(s) above, using the given indexes.` });
    const { text, usage } = await claudeCall(SLIDE_SYSTEM, content, 8000);
    usages.push(usage);
    const parsed = SlideBatchSchema.safeParse(tryParseJson(text));
    if (!parsed.success) throw new Error("Couldn't read the slides — the AI response was malformed. Your credits were refunded.");
    out.push(...parsed.data.slides);
  }
  return out;
}

const VIDEO_PROMPT = (window: string | null) => `Watch this video closely and return ONLY JSON describing what is literally observable.
${window ? `The video is long: ${window} Describe only those windows.\n` : ""}${DATA_RULE}
{"durationSec":number,"shots":[{"start":number,"end":number,"onScreen":string,"camera":"static"|"pan"|"tilt"|"zoom"|"handheld"|"tracking"|"other","transition":"cut"|"jump-cut"|"dissolve"|"whip"|"match-cut"|"none","onScreenText":[{"text":string (verbatim),"startSec":number,"endSec":number,"position":string}],"speakerOnCamera":boolean,"shotType":"talking-head"|"b-roll"|"screen-recording"|"graphic"|"other"}],"averageShotLengthSec":number,"hookWindow":string (precise description of 0–3s: what is shown, said, written),"audio":{"kind":"music"|"voice"|"voice+music"|"ambient"|"silence","energy":"low"|"medium"|"high","description":string},"ctaFrame":string,"hasSpeech":boolean}`;

export interface PipelineInput {
  db: any;
  analysisId: string;
  url: string;
  postType: string;
  scraped: any;
  setStage: (stage: AnalysisStage) => Promise<void>;
}

export async function runAnalysisPipeline(input: PipelineInput) {
  const started = Date.now();
  const { scraped, postType } = input;
  const usages: Usage[] = [];
  const isVideo = postType === "Reel" || postType === "Video";
  const stored: (StoredMediaRef & { mime?: string; bytes?: number })[] = scraped?.storedMedia ?? [];
  const storedImages = stored.filter((m) => m.kind === "image").slice(0, MAX_SLIDES);
  const storedVideo = stored.find((m) => m.kind === "video") ?? null;
  const usedCdnFallback = stored.length === 0;

  // ---- Stage 1: slides / images (for reels: the cover thumbnail if that's all we have) ----
  await input.setStage("reading_slides");
  const images: { bytes: Uint8Array; mime: string }[] = [];
  if (storedImages.length) {
    for (const m of storedImages) { const x = await loadStoredBytes(m.path, true); if (x) images.push(x); }
  } else if (!storedVideo) {
    for (const u of legacyCdnImageUrls(scraped)) { const x = await loadCdnImage(u); if (x) images.push(x); }
  }
  const slides = images.length ? await readSlides(images, usages) : [];

  // ---- Stage 2: video + transcript ----
  let video: VideoEvidence | null = null;
  let videoError: string | null = null;
  let videoWindow: string | null = null;
  let transcript: string | null = scraped?.transcript ?? null;
  let segments: TranscriptSegment[] = [];
  let hasSpeech: boolean | null = transcript ? true : null;
  let transcriptSource: "scraper" | "elevenlabs" | null = transcript ? "scraper" : null;
  if (isVideo && storedVideo) {
    await input.setStage("watching_video");
    const vid = await loadStoredBytes(storedVideo.path, false);
    if (vid) {
      const dur = scraped?.durationSec ?? null;
      if ((dur && dur > 90) || vid.bytes.length > 100 * 1024 * 1024) videoWindow = "Long video: only the first 60 seconds and last 15 seconds were analyzed in detail.";
      if (vid.bytes.length > VIDEO_INLINE_MAX) {
        videoError = `Video is ${(vid.bytes.length / 1048576).toFixed(0)}MB — too large to send for watching; shot details are inferred.`;
      } else {
        try {
          const { text, usage } = await geminiVideoCall(VIDEO_PROMPT(videoWindow), toBase64(vid.bytes), vid.mime);
          usages.push(usage);
          const p = VideoEvidenceSchema.safeParse(tryParseJson(text));
          if (p.success) video = { ...p.data, analyzedWindow: videoWindow ?? "full video" };
          else videoError = "Video watch returned malformed data; shot details are inferred.";
        } catch (e) { videoError = `Video couldn't be watched: ${(e as Error).message}`; }
      }
      if (!transcript) {
        await input.setStage("transcribing");
        try {
          const t = await transcribeAudio(vid.bytes, vid.mime);
          transcript = t.text; segments = t.segments; hasSpeech = t.hasSpeech;
          transcriptSource = t.hasSpeech ? "elevenlabs" : null;
        } catch (e) { console.warn("[analysis] transcription failed:", (e as Error).message); }
      }
    }
  }
  if (video && hasSpeech === null) hasSpeech = video.hasSpeech;

  // ---- Stage 3: synthesis ----
  await input.setStage("building_blueprint");
  const perf = computePerformance({
    likes: scraped?.likesCount, comments: scraped?.commentsCount,
    views: scraped?.videoViewCount ?? scraped?.videoPlayCount, followers: scraped?.owner?.followersCount,
  });
  const codeLimitations = deriveLimitations({
    postType, coverage: scraped?.scrapeCoverage, storedImages: storedImages.length, hasStoredVideo: !!storedVideo,
    usedCdnFallback, transcript, hasSpeech, videoObserved: !!video, videoWindow,
  });
  if (videoError) codeLimitations.push(videoError);

  const legacyBlock = isVideo
    ? `"videoForensics": {"hook":{"type":string,"element":string,"exactVisibleText":string,"openingAction":string,"curiosityGap":string,"audioHook":string,"strength":number},"pacing":{"overall":string,"averageCutDuration":number,"transitionTypes":string,"rhythmSynced":boolean,"bRollUsage":string},"visual":{"shootingStyle":string,"cameraMovements":string,"shotTypes":string,"colorGrade":string,"productionQuality":string},"audio":{"musicType":string,"musicEnergy":string,"voiceover":string,"audioVisualSync":string},"structure":{"type":string,"act1":string,"act2":string,"act3":string,"cta":string},"performance":{"replayValue":number,"saveValue":number,"shareTrigger":string,"commentTrigger":string,"loopQuality":number}}`
    : postType === "Carousel"
      ? `"carouselForensics": {"overall":{"totalSlides":number,"carouselType":string,"narrativeArc":string,"contentDensity":string,"visualConsistency":string},"slide1":{"hookMechanism":string,"exactVisibleText":string,"layout":string,"colorScheme":string,"typography":string,"firstImpressionScore":number},"middleSlides":[{"purpose":string,"informationDensity":string,"visualType":string,"layoutTemplate":string,"microHook":string}],"finalSlide":{"ctaType":string,"urgencyElement":string,"brandElement":string},"designSystem":{"colorPalette":string,"fontSystem":string,"gridSystem":string,"iconStyle":string,"whiteSpaceUsage":string},"contentStrategy":{"saveWorthiness":number,"valueDelivery":string,"educationalDepth":string}}`
      : `"imageForensics": {"subject":{"primary":string,"position":string,"actionPose":string,"expression":string},"composition":{"technique":string,"foreground":string,"background":string,"depthOfField":string,"visualWeight":string},"color":{"dominant":string,"paletteType":string,"temperature":string,"saturation":string,"contrast":string,"mood":string,"hex":string[]},"lighting":{"source":string,"direction":string,"shadowQuality":string,"overallExposure":string},"text":{"present":boolean,"exactVisibleText":string,"position":string,"style":string,"hierarchy":string},"editing":{"filterStyle":string,"sharpness":string,"grain":string},"psychology":{"primaryVisualHook":string,"emotionalResponse":string,"saveWorthinessElements":string,"shareWorthiness":string}}`;

  const system = `You are IG-Cloner's forensic analyst. You receive OBSERVED evidence extracted from the real post media (slide OCR, a timestamped video shot list, a transcript) plus the exact caption and metrics. Faithfully describe the source; do not paraphrase source text in the evidence fields — quote it verbatim. Every forensic claim must be tagged "observed" (with the slide number or timestamp as evidence) or "inferred" (no direct evidence). If something wasn't available (no video, no transcript), say so in limitations and mark related claims inferred. ${DATA_RULE} Return ONLY one JSON object, no markdown.`;

  const prompt = `POST TYPE: ${postType}
URL: ${input.url}
ACCOUNT: @${scraped?.ownerUsername ?? "unknown"} · followers ${scraped?.owner?.followersCount ?? "unknown"} · verified ${scraped?.owner?.verified ?? "unknown"}
METRICS: likes ${scraped?.likesCount ?? "unknown"}, comments ${scraped?.commentsCount ?? "unknown"}, views ${scraped?.videoViewCount ?? scraped?.videoPlayCount ?? "unknown"}
PERFORMANCE (computed in code, do not change): ${perf.formula}
HASHTAGS: ${(scraped?.hashtags ?? []).join(" ") || "none"}
AUDIO META: ${JSON.stringify(scraped?.audio ?? null)}
KNOWN LIMITATIONS: ${codeLimitations.join(" | ") || "none"}

${wrapData("caption", scraped?.caption ?? "")}

${wrapData("slide_evidence", JSON.stringify(slides))}

${wrapData("video_shot_list", video ? JSON.stringify(video) : "unavailable")}

${wrapData("transcript", transcript ? (segments.length ? segments.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n") : transcript) : "unavailable")}

Return JSON with exactly these keys:
{
 "dna": {
  "contentSummary": string (name the exact visible/spoken message and subject),
  "contentCategory": "Educational"|"Storytelling"|"Motivational"|"Entertainment"|"Business"|"Lifestyle",
  "whyItWorks": string[] (each cites concrete evidence),
  "targetAudience": {"who":string,"desire":string,"trigger":string},
  "contentMedium": {"primary": one medium id from the slide evidence taxonomy,"secondary":string|null,"description":string,"mediumIsTheMessage":boolean,"replicationInstructions":string,"mediumSignals":string[]},
  "hookBreakdown": {"exactText": string (VERBATIM first on-screen line / first spoken sentence / slide-1 headline),"location":"visual"|"spoken"|"caption","type":string,"mechanism":"pattern interrupt"|"curiosity gap"|"contrarian"|"bold claim"|"question"|"shocking stat"|"story open"|"FOMO"|string,"whyItWorks":string,"score":number 1-10,"scoreReasoning":string,"whatWorks":string,"improvement":string},
  "emotionalArchitecture": {"curiosity":0-10,"fomo":0-10,"trust":0-10,"relatability":0-10,"urgency":0-10,"inspiration":0-10},
  "storyStructure": [{"section":string,"timing":string (timestamps for video, slide numbers for carousels),"purpose":string}],
  "captionDNA": {"structure":"Micro"|"Standard"|"Long-form","tone":string,"persuasionStyle":string,"ctaType":"Soft"|"Hard"|"Engagement"|"None","score":number,"hookLine":string (verbatim first caption line),"bodyPattern":string,"lineBreakRhythm":string,"emojiUsage":string,"hashtagPlacement":string,"ctaLine":string (verbatim, "" if none),"keywordTrigger":string|null (e.g. "comment GUIDE")},
  "visualStyle": {"colorMood":string,"composition":string,"textOverlay":"None"|"Subtle"|"Heavy","editStyle":string,"score":number},
  "engagementDrivers": string[],
  "monetizationPotential": string,
  "channelIntelligence": {"primaryNiche":string,"audienceLanguage":string,"contentStrengths":string[]},
  "videoVisualDNA": {"subjectType":string,"subjectDescription":string,"backgroundType":string,"backgroundDescription":string,"colorPalette":{"dominant":string,"secondary":string,"accent":string,"mood":string,"approximateHex":string[]},"textStyle":{"present":boolean,"placement":string,"fontStyle":string,"fontSize":string,"color":string,"animation":string},"lightingStyle":string,"editingStyle":string,"paceAndEnergy":string,"contentFormat":string,"audioStyle":string,"productionLevel":string,"platformAesthetic":string,"recreationInstructions":string}
 },
 "legacyForensics": { ${legacyBlock} },
 "forensics": [{"field":string,"value":string,"provenance":"observed"|"inferred","evidence":string|null (e.g. "slide 2" or "0:03-0:05")}] (10-20 items covering hook, text, palette, subject, pacing, audio, CTA),
 "blueprintNotes": {"slideRoles":[{"index":number,"role":"hook"|"point"|"proof"|"cta","layoutNotes":string,"textRemovalNotes":string (where the original text sits so it can be cleaned)}],"voiceStyle":string,"music":"original"|"licensed"|"unknown","dependencies": string[] (things that can't be recreated exactly: licensed music, a real person's face/voice, third-party logos, location footage)},
 "analysisConfidence": number 0-100 (lower it for each limitation),
 "limitations": string[],
 "clones": [5 items: {"versionNumber":1..5,"angleType":"direct"|"contrarian"|"story"|"authority"|"curiosity" (in that order),"angleLabel":"Direct Improvement"|"Contrarian Angle"|"Storytelling Angle"|"Authority Angle"|"Curiosity Gap","hook":string,"angle":string,"storyStructure":string,"caption":string (complete ready-to-post caption in the source caption's rhythm, line breaks, emoji density and CTA style),"visualDirection":string,"cta":string}]
}
Each clone must reference the real source hook/caption/transcript and keep its mechanism and rhythm.`;

  const call = async (p: string) => { const r = await claudeCall(system, [{ type: "text", text: p }], 16000); usages.push(r.usage); return r.text; };
  const firstText = await call(prompt);
  const { value: syn, repaired } = await parseWithRepair(SynthesisSchema, firstText, (issues, bad) =>
    call(`Your previous JSON failed validation:\n${issues}\n\nReturn the corrected complete JSON object only.\n\nPREVIOUS OUTPUT:\n${bad}`));
  const legacy = ((tryParseJson(firstText) as any)?.legacyForensics) ?? {};

  const forensics = normalizeForensics(syn.forensics);
  const limitations = Array.from(new Set([...codeLimitations, ...syn.limitations]));
  // Confidence cannot exceed what the evidence supports.
  const cap = 100 - codeLimitations.length * 15 - (usedCdnFallback ? 20 : 0);
  const analysisConfidence = Math.max(0, Math.min(100, Math.round(syn.analysisConfidence), cap));

  const dna: any = {
    ...syn.dna,
    performanceScore: perf.score ?? 50,
    performanceBasis: perf,
    forensics: { ...legacy, provenance: forensics },
    analysisConfidence,
    limitations,
  };
  const blueprint = buildBlueprint({
    postType, slides, storedMedia: stored, video, transcript, segments,
    caption: scraped?.caption ?? null, hashtags: scraped?.hashtags ?? [], synthesis: syn,
  });
  // Studios read dna_analysis; embedding the blueprint lets buildSourceContextBlock
  // pick up verbatim OCR/transcript without touching each studio.
  dna.blueprint = blueprint;
  const totalCredits = usages.reduce((n, u) => n + u.credits, 0);
  const evidence = {
    slides, video, usedCdnFallback, transcriptSource, hasSpeech, repaired,
    usage: usages, totalAiCredits: Math.round(totalCredits * 10000) / 10000,
    transcriptionNote: transcriptSource === "elevenlabs" ? "Transcribed with ElevenLabs Scribe (billed to the ElevenLabs account, not to your credits)." : null,
    durationMs: Date.now() - started,
  };
  const models = [CLAUDE_ANALYSIS_MODEL, ...(usages.some((u) => u.model === VIDEO_OBSERVATION_MODEL) ? [VIDEO_OBSERVATION_MODEL] : []), ...(transcriptSource === "elevenlabs" ? ["elevenlabs/scribe_v2"] : [])];
  return { dna, clones: syn.clones, blueprint, evidence, transcript, segments, analysisConfidence, modelUsed: models.join(" + ") };
}
