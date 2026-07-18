import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ ids: z.array(z.string().uuid()).min(1).max(24) });
const BUCKET = "analysis-thumbnails";

async function fetchIgImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Referer: "https://www.instagram.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) return null;
    return { bytes: new Uint8Array(buf), contentType };
  } catch {
    return null;
  }
}

export const ensureAnalysisThumbnails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabase
      .from("analyses")
      .select("id, scraped_data")
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const out: Record<string, string | null> = {};
    await Promise.all(
      (rows ?? []).map(async (row: any) => {
        const key = `${row.id}.jpg`;
        // If already cached, just sign it.
        const { data: signedExisting } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(key, 60 * 60 * 24 * 7);
        if (signedExisting?.signedUrl) {
          // Verify object exists by trying to sign — but signed URL is created even without object.
          // So probe with a HEAD via list.
          const { data: listed } = await supabaseAdmin.storage
            .from(BUCKET)
            .list("", { search: `${row.id}.jpg`, limit: 1 });
          if (listed?.some((f: any) => f.name === key)) {
            out[row.id] = signedExisting.signedUrl;
            return;
          }
        }

        const scraped = row.scraped_data as any;
        const src: string | undefined =
          scraped?.displayUrl ?? scraped?.thumbnailUrl ?? scraped?.imageUrl;
        if (!src) {
          out[row.id] = null;
          return;
        }
        const img = await fetchIgImage(src);
        if (!img) {
          out[row.id] = null;
          return;
        }
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(key, img.bytes, { contentType: img.contentType, upsert: true });
        if (upErr) {
          out[row.id] = null;
          return;
        }
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(key, 60 * 60 * 24 * 7);
        out[row.id] = signed?.signedUrl ?? null;
      }),
    );
    return { thumbnails: out };
  });
