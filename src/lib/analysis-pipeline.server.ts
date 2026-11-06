// Staged post analysis: slide evidence (Claude vision) → video shot list
// (Gemini video input) + transcript (scraper or ElevenLabs) → Claude
// synthesis → blueprint. Each stage is a separate function that reads and
// returns a JSON-serialisable state, so the request handler can run ONE
// stage per request and persist progress between them (a dropped browser
// never loses finished work). Media comes from the private source-media
// bucket, never from expiring CDN links (old analyses fall back, labelled).
// Clone versions are NOT generated here — see generateCloneVersions.
import { MEDIUM_CATEGORIES_PROMPT } from "@/lib/medium";
import {
  CloneSetSchema, DATA_RULE, SlideBatchSchema, SynthesisSchema, VideoEvidenceSchema, buildBlueprint, computePerformance,
  dedupeLimitations, deriveLegacyForensics, deriveLimitations, normalizeForensics, parseWithRepair, sanitizeSlides,
  stillMedium, tryParseJson, wrapData,
  type SlideEvidence, type StoredMediaRef, type TranscriptSegment, type VideoEvidence,
} from "@/lib/analysis-evidence";
import {
  CLAUDE_ANALYSIS_MODEL, VIDEO_OBSERVATION_MODEL, claudeCall, geminiVideoCall, toBase64, transcribeAudio,
  type ClaudeBlock, type Usage,
} from "@/lib/analysis-ai.server";

export type AnalysisStage = "fetching_post" | "saving_media" | "reading_slides" | "watching_video" | "transcribing" | "building_blueprint";

const MAX_SLIDES = 20;
const SLIDE_BATCH = 7;
export const VIDEO_INLINE_MAX = 40 * 1024 * 1024;
const LONG_VIDEO_SEC = 90;

type StoredRef = StoredMediaRef & { mime?: string; bytes?: number; variant?: "hd" | "sd" };

/** Everything the stages produce, persisted between requests in analyses.evidence.partial. */
export interface PipelineState {
  startedAt: number;
  usages: Usage[];
  stageMs: Record<string, number>;
  slides: SlideEvidence[];
  slidesDone: boolean;
  video: VideoEvidence | null;
  videoError: string | null;
  videoNote: string | null;
  videoDone: boolean;
  transcript: string | null;
  segments: TranscriptSegment[];
  hasSpeech: boolean | null;
  transcriptSource: "scraper" | "elevenlabs" | null;
  transcriptionMs: number | null;
}

export function initialState(scraped: any): PipelineState {
  const t = scraped?.transcript ?? null;
  return {
    startedAt: Date.now(), usages: [], stageMs: {}, slides: [], slidesDone: false,
    video: null, videoError: null, videoNote: null, videoDone: false,
    transcript: t, segments: [], hasSpeech: t ? true : null, transcriptSource: t ? "scraper" : null, transcriptionMs: null,
  };
}

const isVideoType = (t: string) => t === "Reel" || t === "Video";

/** Which stage runs next for this state. null = all evidence gathered, synthesis is next. */
export function nextEvidenceStage(postType: string, scraped: any, st: PipelineState): "reading_slides" | "watching_video" | "building_blueprint" {
  if (!st.slidesDone) return "reading_slides";
  if (isVideoType(postType) && !st.videoDone && (scraped?.storedMedia ?? []).some((m: any) => m.kind === "video")) return "watching_video";
  return "building_blueprint";
}

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

/** Pick the video rendition to watch: HD if it fits inline, else the SD copy if we saved one. */
export function pickVideoRendition(stored: StoredRef[]): { pick: StoredRef | null; tooBig: StoredRef | null } {
  const videos = stored.filter((m) => m.kind === "video");
  const hd = videos.find((m) => m.variant !== "sd") ?? null;
  const sd = videos.find((m) => m.variant === "sd") ?? null;
  if (hd && (hd.bytes ?? 0) <= VIDEO_INLINE_MAX) return { pick: hd, tooBig: null };
  if (sd && (sd.bytes ?? 0) <= VIDEO_INLINE_MAX) return { pick: sd, tooBig: null };
  return { pick: null, tooBig: hd ?? sd };
}

const SLIDE_SYSTEM = `You are an OCR-grade visual evidence extractor for social posts. Describe only what is literally visible. Transcribe only text you can actually read in the pixels — never add platform labels, badges, metadata or text you expect to be there; if no text is legible, return exactText "" and textBlocks []. Still images must never get a video medium (use a photo/graphic medium). ${DATA_RULE}
Return ONLY JSON: {"slides":[{"index":number,"exactText":string (verbatim, keep line breaks as \\n and original capitalization; "" if none),"textBlocks":[{"text":string,"vertical":"top"|"center"|"bottom","horizontal":"left"|"center"|"right","sizeRel":"small"|"medium"|"large"|"dominant","weight":"light"|"regular"|"bold"|"black","case":"upper"|"lower"|"title"|"sentence"|"mixed","fontStyle":"serif"|"sans"|"script"|"display"|"mono","handwritten":boolean,"colorHex":"#RRGGBB","backgroundHex":"#RRGGBB"|null}],"palette":["#RRGGBB"],"backgroundHex":"#RRGGBB"|null,"subjects":string[],"composition":string,"cameraAngle":string,"lighting":string,"props":string[],"overlays":string[] (only stickers, logos, watermarks, @handles you can see),"medium":string}]}
Keep descriptive strings short (under 20 words).
${MEDIUM_CATEGORIES_PROMPT}`;

async function readSlides(images: { bytes: Uint8Array; mime: string }[], usages: Usage[]): Promise<SlideEvidence[]> {
  const batches: { start: number; imgs: typeof images }[] = [];
  for (let b = 0; b < images.length; b += SLIDE_BATCH) batches.push({ start: b, imgs: images.slice(b, b + SLIDE_BATCH) });
  // Batches are independent — read them in parallel.
  const results = await Promise.all(batches.map(async ({ start, imgs }) => {
    const content: ClaudeBlock[] = [];
    imgs.forEach((img, i) => {
      content.push({ type: "text", text: `Slide index ${start + i}:` });
      content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: toBase64(img.bytes) } });
    });
    content.push({ type: "text", text: `Extract evidence for the ${imgs.length} slide(s) above, using the given indexes.` });
    const { text, usage } = await claudeCall(SLIDE_SYSTEM, content, 8000, "low");
    usages.push(usage);
    const parsed = SlideBatchSchema.safeParse(tryParseJson(text));
    if (!parsed.success) throw new Error("Couldn't read the slides — the AI response was malformed. Your credits were refunded.");
    return sanitizeSlides(parsed.data.slides, imgs.map((_, i) => start + i));
  }));
  return results.flat();
}

const VIDEO_PROMPT = (note: string | null) => `Watch this video closely and return ONLY JSON describing what is literally observable.
${note ? `${note}\n` : ""}${DATA_RULE}
{"durationSec":number,"shots":[{"start":number,"end":number,"onScreen":string,"camera":"static"|"pan"|"tilt"|"zoom"|"handheld"|"tracking"|"other","transition":"cut"|"jump-cut"|"dissolve"|"whip"|"match-cut"|"none","onScreenText":[{"text":string (verbatim),"startSec":number,"endSec":number,"position":string}],"speakerOnCamera":boolean,"shotType":"talking-head"|"b-roll"|"screen-recording"|"graphic"|"other"}],"averageShotLengthSec":number,"hookWindow":string (precise description of 0–3s: what is shown, said, written),"audio":{"kind":"music"|"voice"|"voice+music"|"ambient"|"silence","energy":"low"|"medium"|"high","description":string},"ctaFrame":string,"hasSpeech":boolean}`;

/** Stage 1: slides / images. For reels this is the cover only when the video itself is unusable. */
export async function runSlidesStage(postType: string, scraped: any, st: PipelineState): Promise<PipelineState> {
  const t0 = Date.now();
  const stored: StoredRef[] = scraped?.storedMedia ?? [];
  const storedImages = stored.filter((m) => m.kind === "image").slice(0, MAX_SLIDES);
  const { pick } = pickVideoRendition(stored);
  const images: { bytes: Uint8Array; mime: string }[] = [];
  if (storedImages.length) {
    const loaded = await Promise.all(storedImages.map((m) => loadStoredBytes(m.path, true)));
    for (const x of loaded) if (x) images.push(x);
  } else if (!stored.length || (isVideoType(postType) && !pick)) {
    // No saved images: old analysis (CDN fallback) or a video we can't watch → read the cover frame.
    const urls = stored.length ? [scraped?.displayUrl ?? scraped?.thumbnailUrl].filter(Boolean) : legacyCdnImageUrls(scraped);
    for (const u of urls) { const x = await loadCdnImage(u); if (x) images.push(x); }
  }
  const usages = [...st.usages];
  const slides = images.length ? await readSlides(images, usages) : [];
  return { ...st, slides, slidesDone: true, usages, stageMs: { ...st.stageMs, reading_slides: Date.now() - t0 } };
}

/** Stage 2: watch the video (Gemini) + transcribe (ElevenLabs) in parallel. */
export async function runVideoStage(postType: string, scraped: any, st: PipelineState, setStage?: (s: AnalysisStage) => Promise<void>): Promise<PipelineState> {
  const t0 = Date.now();
  const stored: StoredRef[] = scraped?.storedMedia ?? [];
  const { pick, tooBig } = pickVideoRendition(stored);
  const usages = [...st.usages];
  let { video, videoError, videoNote, transcript, segments, hasSpeech, transcriptSource, transcriptionMs } = st;
  const dur = Number(scraped?.durationSec ?? scraped?.mediaItems?.find((m: any) => m.kind === "video")?.durationSec) || null;

  if (!pick) {
    if (tooBig) {
      videoError = `Video is ${((tooBig.bytes ?? 0) / 1048576).toFixed(0)}MB${dur ? `, ${Math.round(dur)}s` : ""} and no smaller copy was available — shot list not observed; analyzed the transcript and cover frame instead.`;
      // The transcript service accepts large files, so still capture the speech.
      if (!transcript) {
        await setStage?.("transcribing");
        const tt = Date.now();
        try {
          const big = await loadStoredBytes(tooBig.path, false);
          if (big) {
            const t = await transcribeAudio(big.bytes, big.mime);
            transcript = t.text; segments = t.segments; hasSpeech = t.hasSpeech; transcriptSource = t.hasSpeech ? "elevenlabs" : null;
          }
        } catch (e) { console.warn("[analysis] transcription failed:", (e as Error).message); }
        transcriptionMs = Date.now() - tt;
      }
    }
    return { ...st, videoError, videoDone: true, transcript, segments, hasSpeech, transcriptSource, transcriptionMs, usages, stageMs: { ...st.stageMs, watching_video: Date.now() - t0 } };
  }
  const vid = await loadStoredBytes(pick.path, false);
  if (!vid) return { ...st, videoError: "Saved video couldn't be loaded — shot details are inferred.", videoDone: true };
  if (pick.variant === "sd") videoNote = "Watched the smaller (SD) copy because the HD file was over 40MB — fine on-screen text may be less legible.";
  if (dur && dur > LONG_VIDEO_SEC) videoNote = [videoNote, `Long video (${Math.round(dur)}s) — watched in full; the shot list may be coarser.`].filter(Boolean).join(" ");

  const watch = (async () => {
    try {
      const { text, usage } = await geminiVideoCall(VIDEO_PROMPT(dur && dur > LONG_VIDEO_SEC ? "The video is long: keep the shot list to the main beats." : null), toBase64(vid.bytes), vid.mime);
      usages.push(usage);
      const p = VideoEvidenceSchema.safeParse(tryParseJson(text));
      if (p.success) video = { ...p.data, analyzedWindow: pick.variant === "sd" ? "full video (SD copy)" : "full video" };
      else videoError = "Video watch returned malformed data; shot details are inferred.";
    } catch (e) { videoError = `Video couldn't be watched: ${(e as Error).message}`; }
  })();
  const listen = (async () => {
    if (transcript) return;
    await setStage?.("transcribing");
    const tt = Date.now();
    try {
      const t = await transcribeAudio(vid.bytes, vid.mime);
      transcript = t.text; segments = t.segments; hasSpeech = t.hasSpeech;
      transcriptSource = t.hasSpeech ? "elevenlabs" : null;
    } catch (e) { console.warn("[analysis] transcription failed:", (e as Error).message); }
    transcriptionMs = Date.now() - tt;
  })();
  await Promise.all([watch, listen]);
  if (video && hasSpeech === null) hasSpeech = video.hasSpeech;
  return { ...st, video, videoError, videoNote, videoDone: true, transcript, segments, hasSpeech, transcriptSource, transcriptionMs, usages, stageMs: { ...st.stageMs, watching_video: Date.now() - t0 } };
}

/** Stage 3: synthesis → DNA, compact legacy forensics (derived in code), blueprint. No clones. */
export async function runSynthesisStage(input: { url: string; postType: string; scraped: any }, st: PipelineState) {
  const t0 = Date.now();
  const { scraped, postType } = input;
  const isVideo = isVideoType(postType);
  const stored: StoredRef[] = scraped?.storedMedia ?? [];
  const storedImages = stored.filter((m) => m.kind === "image");
  const usedCdnFallback = stored.length === 0;
  const { slides, video, transcript, segments, hasSpeech } = st;
  const usages = [...st.usages];

  const perf = computePerformance({
    likes: scraped?.likesCount, comments: scraped?.commentsCount,
    views: scraped?.videoViewCount ?? scraped?.videoPlayCount, followers: scraped?.owner?.followersCount,
  });
  const codeLimitations = deriveLimitations({
    postType, coverage: scraped?.scrapeCoverage, storedImages: storedImages.length, hasStoredVideo: stored.some((m) => m.kind === "video"),
    usedCdnFallback, transcript, hasSpeech, videoObserved: !!video, videoWindow: st.videoNote,
  });
  if (st.videoError) codeLimitations.push(st.videoError);

  const system = `You are IG-Cloner's forensic analyst. You receive OBSERVED evidence extracted from the real post media (slide OCR, a timestamped video shot list, a transcript) plus the exact caption and metrics. Faithfully describe the source; quote source text verbatim. Every forensic claim must be tagged "observed" with evidence written as "slide N" (1-based) or "m:ss" timestamps, or tagged "inferred". If something wasn't available, say so and mark related claims inferred. Be concise: short strings, no repetition. ${DATA_RULE} Return ONLY one JSON object, no markdown.`;

  const prompt = `POST TYPE: ${postType}
URL: ${input.url}
ACCOUNT: @${scraped?.ownerUsername ?? "unknown"} · followers ${scraped?.owner?.followersCount ?? "unknown"} · verified ${scraped?.owner?.verified ?? "unknown"}
METRICS: likes ${scraped?.likesCount ?? "unknown"}, comments ${scraped?.commentsCount ?? "unknown"}, views ${scraped?.videoViewCount ?? scraped?.videoPlayCount ?? "unknown"}
PERFORMANCE (computed in code, do not change): ${perf.formula}
HASHTAGS: ${(scraped?.hashtags ?? []).join(" ") || "none"}
AUDIO META: ${JSON.stringify(scraped?.audio ?? null)}
KNOWN LIMITATIONS (already recorded — don't repeat them): ${codeLimitations.join(" | ") || "none"}

${wrapData("caption", scraped?.caption ?? "")}

${wrapData("slide_evidence", JSON.stringify(slides.map((s) => ({ slide: s.index + 1, exactText: s.exactText, textBlocks: s.textBlocks.map((b) => `${b.text} [${b.vertical}-${b.horizontal}, ${b.sizeRel}]`), palette: s.palette, subjects: s.subjects, composition: s.composition, overlays: s.overlays, medium: s.medium }))))}

${wrapData("video_shot_list", video ? JSON.stringify(video) : "unavailable")}

${wrapData("transcript", transcript ? (segments.length ? segments.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n") : transcript) : "unavailable")}

Return JSON with exactly these keys:
{
 "dna": {
  "contentSummary": string,
  "contentCategory": "Educational"|"Storytelling"|"Motivational"|"Entertainment"|"Business"|"Lifestyle",
  "whyItWorks": string[] (3-5, each cites evidence),
  "targetAudience": {"who":string,"desire":string,"trigger":string},
  "contentMedium": {"primary": medium id,"secondary":string|null,"description":string,"mediumIsTheMessage":boolean,"replicationInstructions":string,"mediumSignals":string[]},
  "hookBreakdown": {"exactText": string (VERBATIM first on-screen line / first spoken sentence / slide-1 headline / caption first line),"location":"visual"|"spoken"|"caption","type":string,"mechanism":string,"whyItWorks":string,"score":number 1-10,"scoreReasoning":string,"whatWorks":string,"improvement":string},
  "emotionalArchitecture": {"curiosity":0-10,"fomo":0-10,"trust":0-10,"relatability":0-10,"urgency":0-10,"inspiration":0-10},
  "storyStructure": [{"section":string,"timing":string,"purpose":string}],
  "captionDNA": {"structure":"Micro"|"Standard"|"Long-form","tone":string,"persuasionStyle":string,"ctaType":"Soft"|"Hard"|"Engagement"|"None","score":number,"hookLine":string (verbatim),"bodyPattern":string,"lineBreakRhythm":string,"emojiUsage":string,"hashtagPlacement":string,"ctaLine":string (verbatim, "" if none),"keywordTrigger":string|null},
  "visualStyle": {"colorMood":string,"composition":string,"textOverlay":"None"|"Subtle"|"Heavy","editStyle":string,"score":number},
  "engagementDrivers": string[] (max 4),
  "monetizationPotential": string,
  "channelIntelligence": {"primaryNiche":string,"audienceLanguage":string,"contentStrengths":string[]},
  "videoVisualDNA": {"subjectType":string,"subjectDescription":string,"backgroundType":string,"backgroundDescription":string,"colorPalette":{"dominant":string,"secondary":string,"accent":string,"mood":string,"approximateHex":string[]},"textStyle":{"present":boolean,"placement":string,"fontStyle":string,"fontSize":string,"color":string,"animation":string},"lightingStyle":string,"editingStyle":string,"paceAndEnergy":string,"contentFormat":string,"audioStyle":string,"productionLevel":string,"platformAesthetic":string,"recreationInstructions":string}
 },
 "style": {"pacing":string,"shootingStyle":string,"colorGrade":string,"productionQuality":string,"structureType":string,"acts":string[] (2-4 beats),"formatType":string,"compositionTechnique":string,"mood":string,"saveTrigger":string,"shareTrigger":string,"commentTrigger":string},
 "forensics": [{"field":string,"value":string,"provenance":"observed"|"inferred","evidence":string|null}] (8-14 items),
 "blueprintNotes": {"slideRoles":[{"index":number (0-based),"role":"hook"|"point"|"proof"|"cta","layoutNotes":string,"textRemovalNotes":string}],"voiceStyle":string,"music":"original"|"licensed"|"unknown","dependencies": string[]},
 "analysisConfidence": number 0-100,
 "limitations": string[] (only NEW ones not listed above)
}`;

  const call = async (p: string) => { const r = await claudeCall(system, [{ type: "text", text: p }], 12000, "medium"); usages.push(r.usage); return r.text; };
  const firstText = await call(prompt);
  const { value: syn, repaired } = await parseWithRepair(SynthesisSchema, firstText, (issues, bad) =>
    call(`Your previous JSON failed validation:\n${issues}\n\nReturn the corrected complete JSON object only.\n\nPREVIOUS OUTPUT:\n${bad}`));

  const forensics = normalizeForensics(syn.forensics, { slideCount: slides.length, videoDurationSec: video?.durationSec ?? (video ? Infinity : null) });
  const flagged = forensics.filter((f: any) => f.flagged).length;
  const limitations = dedupeLimitations([...codeLimitations, ...syn.limitations]);
  // Confidence cannot exceed what the evidence supports.
  const cap = 100 - codeLimitations.length * 15 - (usedCdnFallback ? 20 : 0);
  const analysisConfidence = Math.max(0, Math.min(100, Math.round(syn.analysisConfidence), cap));
  if (!isVideo) syn.dna.contentMedium.primary = stillMedium(syn.dna.contentMedium.primary, slides.some((s) => s.exactText));

  const legacy = deriveLegacyForensics({ postType, slides, video, dna: syn.dna, style: syn.style, transcript });
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
  const stageMs = { ...st.stageMs, building_blueprint: Date.now() - t0 };
  const evidence = {
    slides, video, usedCdnFallback, transcriptSource: st.transcriptSource, hasSpeech, repaired, flaggedForensics: flagged,
    videoNote: st.videoNote, videoError: st.videoError,
    usage: usages, totalAiCredits: Math.round(totalCredits * 10000) / 10000,
    transcriptionNote: st.transcriptSource === "elevenlabs" ? "Transcribed with ElevenLabs Scribe (billed to the ElevenLabs account, not to your credits)." : null,
    transcriptionMs: st.transcriptionMs,
    stageMs,
    durationMs: Object.values(stageMs).reduce((a, b) => a + b, 0),
  };
  const models = [CLAUDE_ANALYSIS_MODEL, ...(usages.some((u) => u.model === VIDEO_OBSERVATION_MODEL) ? [VIDEO_OBSERVATION_MODEL] : []), ...(st.transcriptSource === "elevenlabs" ? ["elevenlabs/scribe_v2"] : [])];
  return { dna, blueprint, evidence, transcript, segments, analysisConfidence, modelUsed: models.join(" + ") };
}

/** All stages in one go (scripts / tests). The request handler runs them one per request. */
export async function runAnalysisPipeline(input: { url: string; postType: string; scraped: any; setStage?: (s: AnalysisStage) => Promise<void> }) {
  let st = initialState(input.scraped);
  await input.setStage?.("reading_slides");
  st = await runSlidesStage(input.postType, input.scraped, st);
  if (nextEvidenceStage(input.postType, input.scraped, st) === "watching_video") {
    await input.setStage?.("watching_video");
    st = await runVideoStage(input.postType, input.scraped, st, input.setStage);
  }
  await input.setStage?.("building_blueprint");
  return runSynthesisStage(input, st);
}

const CLONE_SYSTEM = `You write 5 ready-to-post versions of a proven social post, grounded in what the source actually says and shows. ${DATA_RULE} Return ONLY JSON.`;

/** The 5 angle versions from saved evidence/blueprint (on demand, not part of the analysis). */
export async function generateClonesFromEvidence(input: {
  postType: string; account: string | null; dna: any; blueprint: any; caption: string | null; transcript: string | null; segments: TranscriptSegment[];
}) {
  const d = input.dna ?? {};
  const bp = input.blueprint ?? {};
  const onScreen = [
    ...(bp.slides ?? []).map((s: any) => s.exactText && `slide ${s.index + 1}: ${s.exactText}`),
    ...(bp.scenes ?? []).flatMap((sc: any) => (sc.onScreenText ?? []).map((t: any) => `${Math.round(sc.start)}s: ${t.text}`)),
  ].filter(Boolean).join("\n");
  const prompt = `SOURCE: ${input.postType} by @${input.account ?? "unknown"}
EXACT HOOK (${d.hookBreakdown?.location ?? "?"}): ${d.hookBreakdown?.exactText ?? ""} — mechanism: ${d.hookBreakdown?.mechanism ?? ""}
CAPTION STRUCTURE: ${JSON.stringify(d.captionDNA ?? {})}
STORY STRUCTURE: ${JSON.stringify(d.storyStructure ?? [])}
${wrapData("caption", input.caption ?? "")}
${wrapData("on_screen_text", onScreen || "none")}
${wrapData("transcript", input.transcript ? input.transcript.slice(0, 4000) : "none")}

Write 5 versions in this order: direct, contrarian, story, authority, curiosity. Each must reference the real source hook/caption/transcript, keep the source's hook mechanism and rhythm (line breaks, emoji density, CTA style), and include a complete ready-to-post caption.
{"clones":[{"versionNumber":1-5,"angleType":"direct"|"contrarian"|"story"|"authority"|"curiosity","angleLabel":"Direct Improvement"|"Contrarian Angle"|"Storytelling Angle"|"Authority Angle"|"Curiosity Gap","hook":string,"angle":string,"storyStructure":string,"caption":string,"visualDirection":string,"cta":string}]}`;
  const call = async (p: string) => (await claudeCall(CLONE_SYSTEM, [{ type: "text", text: p }], 8000, "medium")).text;
  const first = await call(prompt);
  const { value } = await parseWithRepair(CloneSetSchema, first, (issues, bad) => call(`Fix this JSON:\n${issues}\n\n${bad}\n\nReturn the corrected JSON only.`));
  return value.clones;
}
