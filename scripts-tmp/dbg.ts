import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data: r } = await supabaseAdmin.from("analyses").select("scraped_data").eq("id", "0c66fd8f-cce8-46a4-9608-eefb7bcd694d").single();
const m = (r as any).scraped_data.storedMedia[0];
const { data } = await supabaseAdmin.storage.from("source-media").download(m.path);
await Bun.write("/tmp/p3/img_full", await data!.arrayBuffer());
console.log(m);
