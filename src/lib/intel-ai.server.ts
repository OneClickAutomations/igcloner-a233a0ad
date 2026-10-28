// Claude uses the gateway's native Messages stream, consumed server-side.
export async function generateIntelJson(system: string, prompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI connection is not configured.");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST", headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: "anthropic/claude-sonnet-5", max_tokens: 24000, stream: true, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as any;
    throw new Error(error.message ?? error.error?.message ?? `AI request failed (${response.status}).`);
  }
  if (!response.body) throw new Error("AI returned an empty response.");
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let buffer = "", text = "", stopped = false;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.slice(6).trim() === "[DONE]") continue;
      const event = JSON.parse(line.slice(6));
      if (event.type === "error") throw new Error(event.error?.message ?? "AI generation failed.");
      if (event.delta?.type === "text_delta") text += event.delta.text;
      if (event.delta?.stop_reason === "refusal") throw new Error("The AI declined this request.");
      if (event.delta?.stop_reason === "max_tokens") throw new Error("The report exceeded the AI output budget. No incomplete report was saved.");
      if (event.type === "message_stop") stopped = true;
    }
    if (done) break;
  }
  if (!stopped || !text.trim()) throw new Error("AI generation ended before the report was complete.");
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(clean); } catch { throw new Error("AI returned invalid report data. Please start a fresh generation."); }
}