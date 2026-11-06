// Server-only AI + media helpers for the staged post analysis.
// Claude (native streaming Messages) for vision + synthesis, Gemini (Chat
// Completions, video input) for the shot list only, ElevenLabs Scribe for
// transcription. Credentials never leave the server.

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const CLAUDE_ANALYSIS_MODEL = "anthropic/claude-sonnet-5";
export const VIDEO_OBSERVATION_MODEL = "google/gemini-3.8-flash";

// Gateway list prices (workspace credits per token) used for the cost note.
const PRICE = {
  [CLAUDE_ANALYSIS_MODEL]: { in: 0.000008, out: 0.00004 },
  [VIDEO_OBSERVATION_MODEL]: { in: 0.000003, out: 0.000015 },
} as Record<string, { in: number; out: number }>;

export interface Usage { model: string; inputTokens: number; outputTokens: number; credits: number }
function usage(model: string, i: number, o: number): Usage {
  const p = PRICE[model] ?? { in: 0, out: 0 };
  return { model, inputTokens: i, outputTokens: o, credits: i * p.in + o * p.out };
}

function apiKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("AI connection is not configured.");
  return k;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export type ClaudeBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** Streaming Claude Messages call, consumed server-side. Returns final text + usage. */
export async function claudeCall(system: string, content: ClaudeBlock[], maxTokens: number): Promise<{ text: string; usage: Usage }> {
  const res = await fetch(`${GATEWAY}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: CLAUDE_ANALYSIS_MODEL, max_tokens: maxTokens, stream: true, system, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any;
    throw new Error(err.message ?? err.error?.message ?? `AI request failed (${res.status}).`);
  }
  if (!res.body) throw new Error("AI returned an empty response.");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", stopped = false, inTok = 0, outTok = 0;
  while (true) {
    const { value, done } = await reader.read();
    buf += dec.decode(value, { stream: !done });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.type === "error") throw new Error(ev.error?.message ?? "AI generation failed.");
      if (ev.type === "message_start") inTok = ev.message?.usage?.input_tokens ?? 0;
      if (ev.usage?.output_tokens) outTok = ev.usage.output_tokens;
      if (ev.delta?.type === "text_delta") text += ev.delta.text;
      if (ev.delta?.stop_reason === "refusal") throw new Error("The AI declined to analyze this post.");
      if (ev.delta?.stop_reason === "max_tokens") throw new Error("The analysis exceeded the AI output budget and was not saved. Your credits were refunded.");
      if (ev.type === "message_stop") stopped = true;
    }
    if (done) break;
  }
  if (!stopped || !text.trim()) throw new Error("The AI stopped before the analysis was complete.");
  return { text, usage: usage(CLAUDE_ANALYSIS_MODEL, inTok, outTok) };
}

/** Gemini video observation via Chat Completions with an inline video. Streams. */
export async function geminiVideoCall(prompt: string, videoB64: string, mime: string): Promise<{ text: string; usage: Usage }> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: VIDEO_OBSERVATION_MODEL,
      stream: true,
      stream_options: { include_usage: true },
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "video_url", video_url: { url: `data:${mime};base64,${videoB64}` } }] }],
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any;
    throw new Error(err.message ?? err.error?.message ?? `Video analysis failed (${res.status}).`);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", inTok = 0, outTok = 0;
  while (true) {
    const { value, done } = await reader.read();
    buf += dec.decode(value, { stream: !done });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.slice(6).trim() === "[DONE]") continue;
      const ev = JSON.parse(line.slice(6));
      text += ev.choices?.[0]?.delta?.content ?? "";
      if (ev.usage) { inTok = ev.usage.prompt_tokens ?? 0; outTok = ev.usage.completion_tokens ?? 0; }
    }
    if (done) break;
  }
  if (!text.trim()) throw new Error("Video analysis returned nothing.");
  return { text, usage: usage(VIDEO_OBSERVATION_MODEL, inTok, outTok) };
}

/** ElevenLabs Scribe batch transcription with word timestamps, language auto-detect. */
export async function transcribeAudio(bytes: Uint8Array, mime: string): Promise<{ text: string | null; segments: { text: string; start: number; end: number }[]; hasSpeech: boolean; language: string | null; durationSec: number | null }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Transcription service is not configured.");
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), "audio.mp4");
  form.append("model_id", "scribe_v2");
  form.append("tag_audio_events", "true");
  form.append("timestamps_granularity", "word");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: form });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  const words = (data.words ?? []).filter((w: any) => w.type === "word");
  // Group words into ~sentence segments (break on punctuation or >0.8s gap).
  const segments: { text: string; start: number; end: number }[] = [];
  let cur: { text: string; start: number; end: number } | null = null;
  for (const w of words) {
    if (!cur || w.start - cur.end > 0.8) { if (cur) segments.push(cur); cur = { text: w.text, start: w.start, end: w.end }; }
    else { cur.text += " " + w.text; cur.end = w.end; }
    if (/[.!?]$/.test(w.text)) { segments.push(cur); cur = null; }
  }
  if (cur) segments.push(cur);
  const hasSpeech = words.length >= 3;
  const last = (data.words ?? []).at(-1);
  return {
    text: hasSpeech ? String(data.text ?? "").trim() : null,
    segments: hasSpeech ? segments : [],
    hasSpeech,
    language: data.language_code ?? null,
    durationSec: last?.end ?? null,
  };
}
