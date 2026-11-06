import { runAnalysisPipeline, generateClonesFromEvidence } from "@/lib/analysis-pipeline.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
const ids = process.argv.slice(2);
const withClones = process.env.CLONES === "1";
await Promise.all(ids.map(async (id) => {
  const { data: r } = await supabaseAdmin.from("analyses").select("*").eq("id", id).single();
  const a: any = r;
  const t0 = Date.now();
  const res = await runAnalysisPipeline({ url: a.instagram_url, postType: a.post_type, scraped: a.scraped_data });
  const ms = Date.now() - t0;
  await supabaseAdmin.from("analyses").update({ dna_analysis: res.dna, performance_score: res.dna.performanceScore, blueprint: res.blueprint, evidence: res.evidence, transcript: res.transcript, transcript_segments: res.segments, analysis_confidence: res.analysisConfidence, model_used: res.modelUsed } as any).eq("id", id);
  const ev: any = res.evidence;
  const out: any = {
    id, type: a.post_type, ms, stageMs: ev.stageMs, credits: ev.totalAiCredits, usd: +(ev.totalAiCredits * 0.375).toFixed(3),
    tokens: ev.usage.map((u: any) => `${u.model.split("/")[1]} ${u.inputTokens}/${u.outputTokens}`),
    conf: res.analysisConfidence, hook: res.dna.hookBreakdown, medium: res.dna.contentMedium.primary,
    slides: ev.slides.map((s: any) => ({ i: s.index, text: s.exactText, medium: s.medium, overlays: s.overlays })),
    limitations: res.dna.limitations, flagged: ev.flaggedForensics, transcriptMs: ev.transcriptionMs,
    transcript: res.transcript?.slice(0, 300), segs: res.segments.slice(0, 4), videoNote: ev.videoNote, videoError: ev.videoError,
  };
  if (withClones) {
    const c0 = Date.now();
    const cl = await generateClonesFromEvidence({ postType: a.post_type, account: a.source_account, dna: res.dna, blueprint: res.blueprint, caption: a.source_caption, transcript: res.transcript, segments: res.segments });
    out.clonesMs = Date.now() - c0; out.clones = cl.map((c) => c.hook);
  }
  await Bun.write(`/tmp/rr-${id}.json`, JSON.stringify(out, null, 1));
  console.log(id, a.post_type, ms, "ms", ev.totalAiCredits, "cr", "conf", res.analysisConfidence);
}).map((p) => p.catch((e) => console.error("FAIL", e.message))));
