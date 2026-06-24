// Client-safe shared types for the Reel Studio audio engine.
// Do not import server-only modules here.

export type AudioMode =
  | "auto"
  | "native"
  | "voiceover"
  | "music"
  | "voice-music"
  | "voice-music-sfx"
  | "ambient";

export type SfxIntensity = "none" | "subtle" | "standard" | "cinematic" | "heavy";

export type MusicGenre =
  | "none"
  | "trending-reel"
  | "cinematic"
  | "motivational"
  | "luxury"
  | "corporate"
  | "inspiring"
  | "technology"
  | "documentary"
  | "emotional"
  | "nature"
  | "ambient"
  | "lofi"
  | "electronic"
  | "epic";

export const MUSIC_GENRES: { v: MusicGenre; l: string }[] = [
  { v: "trending-reel", l: "Trending Reel" },
  { v: "cinematic", l: "Cinematic" },
  { v: "motivational", l: "Motivational" },
  { v: "luxury", l: "Luxury" },
  { v: "corporate", l: "Corporate" },
  { v: "inspiring", l: "Inspiring" },
  { v: "technology", l: "Technology" },
  { v: "documentary", l: "Documentary" },
  { v: "emotional", l: "Emotional" },
  { v: "nature", l: "Nature" },
  { v: "ambient", l: "Ambient" },
  { v: "lofi", l: "Lo-Fi" },
  { v: "electronic", l: "Electronic" },
  { v: "epic", l: "Epic" },
  { v: "none", l: "No Music" },
];

export type ReelStylePreset =
  | "documentary"
  | "educational"
  | "luxury"
  | "business"
  | "motivational"
  | "storytelling"
  | "news"
  | "nature"
  | "product"
  | "lifestyle"
  | "cinematic"
  | "viral";

export interface ReelStyleConfig {
  id: ReelStylePreset;
  label: string;
  blurb: string;
  pace: "slow" | "medium" | "fast";
  defaultAudioMode: AudioMode;
  defaultMusicGenre: MusicGenre;
  defaultSfx: SfxIntensity;
  defaultVoiceCategory: string; // matches VoicePreset categories
}

export const REEL_STYLES: ReelStyleConfig[] = [
  { id: "documentary",  label: "Documentary",       blurb: "Authoritative narration over grounded b-roll.", pace: "medium", defaultAudioMode: "voice-music", defaultMusicGenre: "documentary", defaultSfx: "subtle",    defaultVoiceCategory: "narration" },
  { id: "educational",  label: "Educational",       blurb: "Clear teaching voice with calm support track.",  pace: "medium", defaultAudioMode: "voice-music", defaultMusicGenre: "corporate",    defaultSfx: "subtle",    defaultVoiceCategory: "conversational" },
  { id: "luxury",       label: "Luxury",            blurb: "Premium look with refined cinematic score.",     pace: "slow",   defaultAudioMode: "voice-music", defaultMusicGenre: "luxury",       defaultSfx: "subtle",    defaultVoiceCategory: "warm" },
  { id: "business",     label: "Business",          blurb: "Confident expert voice over corporate bed.",     pace: "medium", defaultAudioMode: "voice-music", defaultMusicGenre: "corporate",    defaultSfx: "subtle",    defaultVoiceCategory: "narration" },
  { id: "motivational", label: "Motivational",      blurb: "Driving anthem + powerful delivery.",            pace: "fast",   defaultAudioMode: "voice-music-sfx", defaultMusicGenre: "motivational", defaultSfx: "cinematic", defaultVoiceCategory: "energetic" },
  { id: "storytelling", label: "Storytelling",      blurb: "Warm storyteller voice + emotional bed.",        pace: "medium", defaultAudioMode: "voice-music", defaultMusicGenre: "emotional",    defaultSfx: "subtle",    defaultVoiceCategory: "warm" },
  { id: "news",         label: "News",              blurb: "Broadcast anchor + sharp transitions.",          pace: "fast",   defaultAudioMode: "voice-music-sfx", defaultMusicGenre: "corporate",    defaultSfx: "standard",  defaultVoiceCategory: "news" },
  { id: "nature",       label: "Nature",            blurb: "Ambient soundscape + atmospheric music.",        pace: "slow",   defaultAudioMode: "ambient",      defaultMusicGenre: "nature",       defaultSfx: "subtle",    defaultVoiceCategory: "calm" },
  { id: "product",      label: "Product Showcase",  blurb: "Crisp product motion + premium swells.",         pace: "medium", defaultAudioMode: "voice-music-sfx", defaultMusicGenre: "technology",   defaultSfx: "cinematic", defaultVoiceCategory: "social" },
  { id: "lifestyle",    label: "Lifestyle",         blurb: "Friendly creator voice over trending music.",    pace: "fast",   defaultAudioMode: "voice-music", defaultMusicGenre: "trending-reel",defaultSfx: "subtle",    defaultVoiceCategory: "social" },
  { id: "cinematic",    label: "Cinematic",         blurb: "Trailer-grade score + heavy sound design.",      pace: "medium", defaultAudioMode: "voice-music-sfx", defaultMusicGenre: "cinematic",    defaultSfx: "heavy",     defaultVoiceCategory: "trailer" },
  { id: "viral",        label: "Viral Reel",        blurb: "Punchy hook, trending bed, snappy SFX.",         pace: "fast",   defaultAudioMode: "voice-music-sfx", defaultMusicGenre: "trending-reel",defaultSfx: "standard",  defaultVoiceCategory: "energetic" },
];

export interface AudioMixProfile {
  voice: number;   // 0-100
  music: number;
  ambient: number;
  sfx: number;
  master: number;
  autoDuck: boolean;
}

export const DEFAULT_MIX: AudioMixProfile = {
  voice: 100,
  music: 35,
  ambient: 25,
  sfx: 55,
  master: 90,
  autoDuck: true,
};

export interface AudioPlan {
  mode: AudioMode;
  stylePreset?: ReelStylePreset;
  // Voice
  voiceCategory?: string;
  voiceId?: string;
  voiceTone?: string;
  scriptMode?: "auto" | "paste" | "hook-only" | "cta-only" | "dna";
  script?: string;
  voiceAssetUrl?: string;
  // Music
  musicGenre?: MusicGenre;
  musicPrompt?: string;
  musicAssetUrl?: string;
  // Ambient
  ambientPrompt?: string;
  ambientAssetUrl?: string;
  // SFX
  sfxIntensity?: SfxIntensity;
  // Captions
  captionStyle?: "burned-in" | "srt" | "dynamic" | "tiktok" | "instagram" | "premium" | "brand" | "none";
  // Platform
  platform?: "instagram" | "tiktok" | "youtube-shorts" | "facebook-reels" | "linkedin" | "x";
  // Director-strategy summary (advisory text)
  strategy?: {
    visual?: string;
    motion?: string;
    voice?: string;
    music?: string;
    sound?: string;
    hook?: string;
  };
  hookVariations?: string[];
}

export const PLATFORM_OPTIONS = [
  { v: "instagram",       l: "Instagram",       aspect: "9:16" as const, maxLen: 90 },
  { v: "tiktok",          l: "TikTok",          aspect: "9:16" as const, maxLen: 90 },
  { v: "youtube-shorts",  l: "YouTube Shorts",  aspect: "9:16" as const, maxLen: 60 },
  { v: "facebook-reels",  l: "Facebook Reels",  aspect: "9:16" as const, maxLen: 90 },
  { v: "linkedin",        l: "LinkedIn",        aspect: "1:1"  as const, maxLen: 60 },
  { v: "x",               l: "X / Twitter",     aspect: "16:9" as const, maxLen: 60 },
];

export const CAPTION_STYLES = [
  { v: "none",       l: "None" },
  { v: "burned-in",  l: "Burned-in (clean)" },
  { v: "srt",        l: "Separate SRT" },
  { v: "dynamic",    l: "Dynamic word highlight" },
  { v: "tiktok",     l: "TikTok style" },
  { v: "instagram",  l: "Instagram style" },
  { v: "premium",    l: "Premium / serif" },
  { v: "brand",      l: "Brand profile" },
] as const;

export const VOICE_CATEGORIES = [
  { v: "narration",      l: "Professional Narrator" },
  { v: "warm",           l: "Storyteller / Warm" },
  { v: "news",           l: "News Anchor / Documentary" },
  { v: "conversational", l: "Business Expert / Conversational" },
  { v: "energetic",      l: "Motivational / Energetic" },
  { v: "trailer",        l: "Cinematic / Luxury Brand" },
  { v: "social",         l: "Casual Creator" },
  { v: "calm",           l: "Podcast Host / Calm" },
  { v: "character",      l: "Character Voice" },
];