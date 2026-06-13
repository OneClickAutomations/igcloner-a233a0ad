/**
 * Robust JSON extraction for AI model responses.
 * Handles markdown fences, leading/trailing prose, trailing commas,
 * control characters, and truncated output (best-effort brace balancing).
 */
export function extractJson<T = any>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const startIdx = cleaned.search(/[\{\[]/);
  if (startIdx === -1) {
    console.error("[extractJson] No JSON found. First 400:", cleaned.slice(0, 400));
    throw new Error("AI returned malformed JSON");
  }
  const openChar = cleaned[startIdx];
  const closeChar = openChar === "[" ? "]" : "}";
  const lastIdx = cleaned.lastIndexOf(closeChar);
  const candidate =
    lastIdx > startIdx ? cleaned.slice(startIdx, lastIdx + 1) : cleaned.slice(startIdx);

  const attempts: Array<(s: string) => string> = [
    (s) => s,
    (s) =>
      s
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""),
    (s) => {
      let opens = 0,
        closes = 0,
        sqOpens = 0,
        sqCloses = 0,
        inStr = false,
        esc = false;
      for (const ch of s) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === '"') inStr = !inStr;
        if (inStr) continue;
        if (ch === "{") opens++;
        else if (ch === "}") closes++;
        else if (ch === "[") sqOpens++;
        else if (ch === "]") sqCloses++;
      }
      let repaired = s.replace(/,\s*$/, "");
      if (inStr) repaired += '"';
      repaired += "]".repeat(Math.max(0, sqOpens - sqCloses));
      repaired += "}".repeat(Math.max(0, opens - closes));
      return repaired;
    },
  ];

  let lastErr: unknown;
  for (const fix of attempts) {
    try {
      return JSON.parse(fix(candidate)) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("[extractJson] Parse failed. First 400:", candidate.slice(0, 400));
  console.error("[extractJson] Last 400:", candidate.slice(-400));
  console.error("[extractJson] Error:", lastErr);
  throw new Error("AI returned malformed JSON");
}