// Resolves a user's BYO Upload-Post API key from user_api_keys.
// Returns null when the user hasn't connected their own key, in which case
// callers fall back to the platform-wide env key (which may be missing).

export async function getUserUploadPostApiKey(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptApiKey } = await import("@/lib/encryption.server");
  const { data, error } = await supabaseAdmin
    .from("user_api_keys")
    .select("encrypted_key, status")
    .eq("user_id", userId)
    .eq("provider", "upload_post")
    .maybeSingle();
  if (error || !data) return null;
  // Use the key even if status is "unvalidated" — only skip on hard "invalid".
  if (data.status === "invalid") return null;
  try {
    return decryptApiKey(data.encrypted_key as string);
  } catch {
    return null;
  }
}