import { supabaseAdmin } from "@/integrations/supabase/client.server";
for (const id of ["8258f4bd-56d0-44e0-b2cd-7151caa6beed","fc60299d-7c8d-4254-b6b6-c3afd529762e","8fb5a4ae-6734-4d89-8c16-af34f186fc2a"]) {
const { data: r } = await supabaseAdmin.from("analyses").select("dna_analysis").eq("id", id).single();
for (const f of (r as any).dna_analysis.forensics.provenance) if (f.flagged) console.log(id.slice(0,4), f.field, "|", f.evidence);
}
