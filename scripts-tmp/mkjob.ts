import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { initialState } from "@/lib/analysis-pipeline.server";
const { data: r } = await supabaseAdmin.from("analyses").select("*").eq("id", "fc60299d-7c8d-4254-b6b6-c3afd529762e").single();
const a: any = r; const id = crypto.randomUUID();
const st = { ...initialState(a.scraped_data), slidesDone: true };
const { error } = await supabaseAdmin.from("analyses").insert({ id, user_id: a.user_id, instagram_url: a.instagram_url + "?resume-test", post_type: a.post_type, source_account: a.source_account, source_caption: a.source_caption, scraped_data: a.scraped_data, analysis_status: "processing", analysis_stage: "watching_video", last_progress_at: new Date().toISOString(), evidence: { partial: st } } as any);
console.log(error?.message ?? id);
