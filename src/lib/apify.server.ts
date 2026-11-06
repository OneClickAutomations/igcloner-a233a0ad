// Server-only Apify helpers: key resolution (user's own key wins, platform
// APIFY_TOKEN fallback) and a run-sync wrapper shared by research and
// content analysis.

/**
 * Resolve the Apify token for a user: their own stored key if valid, else
 * the platform token. Returns null when neither exists.
 */
export async function resolveApifyToken(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("encrypted_key, status")
    .eq("user_id", userId)
    .eq("provider", "apify")
    .maybeSingle();
  if (keyRow?.encrypted_key && keyRow.status !== "invalid") {
    const { decryptApiKey } = await import("@/lib/encryption.server");
    const key = decryptApiKey(keyRow.encrypted_key);
    if (key) return key;
  }
  return process.env.APIFY_TOKEN ?? null;
}

/** Run an actor synchronously and return its dataset items. */
export async function apifyRun(actor: string, input: unknown, token: string): Promise<any[]> {
  if (!token) throw new Error("APIFY_TOKEN not configured");
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[Apify]", actor, res.status, text.slice(0, 300));
    const err = new Error(`Apify ${actor} failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
