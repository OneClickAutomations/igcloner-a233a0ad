import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { geminiVideoCall, toBase64 } from "@/lib/analysis-ai.server";
import { VideoEvidenceSchema, tryParseJson } from "@/lib/analysis-evidence";
const { data: r } = await supabaseAdmin.from("analyses").select("scraped_data").eq("id", "8258f4bd-56d0-44e0-b2cd-7151caa6beed").single();
const m = (r as any).scraped_data.storedMedia.find((x: any) => x.kind === "video");
console.log(m.bytes);
const { data } = await supabaseAdmin.storage.from("source-media").download(m.path);
const b = new Uint8Array(await data!.arrayBuffer());
const { text, usage } = await geminiVideoCall(`Watch this video closely and return ONLY JSON describing what is literally observable. The video is long: keep the shot list to the main beats.
{"durationSec":number,"shots":[{"start":number,"end":number,"onScreen":string,"camera":string,"transition":string,"onScreenText":[{"text":string,"startSec":number,"endSec":number,"position":string}],"speakerOnCamera":boolean,"shotType":string}],"averageShotLengthSec":number,"hookWindow":string,"audio":{"kind":string,"energy":string,"description":string},"ctaFrame":string,"hasSpeech":boolean}`, toBase64(b), m.mime);
console.log(usage, text.length, JSON.stringify(text.slice(0, 200)), JSON.stringify(text.slice(-300)));
const j = tryParseJson(text); console.log("parsed", !!j);
if (j) { const p = VideoEvidenceSchema.safeParse(j); console.log(p.success ? "ok" : JSON.stringify(p.error.issues.slice(0,5))); }
