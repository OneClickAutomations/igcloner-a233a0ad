export type VoiceCategory =
  | "narration"
  | "conversational"
  | "energetic"
  | "calm"
  | "character"
  | "news"
  | "trailer"
  | "warm"
  | "social";

export interface VoicePreset {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  accent: string;
  categories: VoiceCategory[];
  description: string;
}

export const VOICE_CATALOG: VoicePreset[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George",   gender: "male",   accent: "British",  categories: ["narration", "warm", "trailer"],         description: "Warm, authoritative British narrator." },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian",    gender: "male",   accent: "American", categories: ["narration", "news", "trailer"],         description: "Deep, broadcast-quality American voice." },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will",     gender: "male",   accent: "American", categories: ["conversational", "social", "energetic"],description: "Friendly, modern, perfect for IG reels." },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric",     gender: "male",   accent: "American", categories: ["conversational", "warm"],               description: "Calm, trustworthy, podcast-style." },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel",   gender: "male",   accent: "British",  categories: ["news", "trailer", "narration"],         description: "News anchor energy with gravitas." },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris",    gender: "male",   accent: "American", categories: ["conversational", "social"],             description: "Casual, friendly, every-day guy." },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill",     gender: "male",   accent: "American", categories: ["narration", "calm"],                    description: "Mature documentary narrator." },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam",     gender: "male",   accent: "American", categories: ["energetic", "social"],                  description: "Young, upbeat, high-energy." },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie",  gender: "male",   accent: "Australian",categories: ["conversational", "energetic"],         description: "Aussie charm, conversational." },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum",   gender: "male",   accent: "British",  categories: ["character", "trailer"],                 description: "Intense, slightly raspy character voice." },

  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",    gender: "female", accent: "American", categories: ["conversational", "social", "warm"],     description: "Soft, friendly, great for storytelling." },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura",    gender: "female", accent: "American", categories: ["narration", "calm"],                    description: "Smooth, professional, audiobook-grade." },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice",    gender: "female", accent: "British",  categories: ["narration", "news"],                    description: "Clear, articulate British presenter." },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda",  gender: "female", accent: "American", categories: ["warm", "narration"],                    description: "Warm, friendly storyteller." },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica",  gender: "female", accent: "American", categories: ["conversational", "energetic", "social"],description: "Bright, expressive, made for short-form." },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily",     gender: "female", accent: "British",  categories: ["calm", "warm"],                         description: "Gentle, soothing British voice." },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River",    gender: "neutral",accent: "American", categories: ["conversational", "calm"],               description: "Smooth, gender-neutral, modern." },
];

