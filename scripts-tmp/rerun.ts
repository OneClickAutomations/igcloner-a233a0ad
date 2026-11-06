import { runAnalysisPipeline } from "@/lib/analysis-pipeline.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeFileSync } from "node:fs";

const id = process.argv[2];
const { data: row, error } = await supabaseAdmin.from("analyses").select("*").eq("id", id).single();
if (error || !row) throw error;
const t0 = Date.now();
try {
  const r = await runAnalysisPipeline({
    db: supabaseAdmin, analysisId: id, url: row.instagram_url, postType: row.post_type!, scraped: row.scraped_data,
    setStage: async (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] stage ${s}`),
  });
  await supabaseAdmin.from("analyses").update({
    dna_analysis: r.dna, performance_score: r.dna.performanceScore, blueprint: r.blueprint as any, evidence: r.evidence as any,
    transcript: r.transcript, transcript_segments: r.segments as any, analysis_confidence: r.analysisConfidence,
    model_used: r.modelUsed, analysis_status: "ready",
  } as any).eq("id", id);
  writeFileSync(`/tmp/p2/out-${id}.json`, JSON.stringify(r, null, 2));
  console.log("DONE", ((Date.now() - t0) / 1000).toFixed(1), "s", r.modelUsed, "conf", r.analysisConfidence, "credits", r.evidence.totalAiCredits);
} catch (e) { console.log("FAIL", (e as Error).message); }
