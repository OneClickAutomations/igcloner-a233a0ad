import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, X } from "lucide-react";

export type UserPreferences = {
  niche: string;
  contentGoal: string;
  selectedAngles: string[];
  targetAudience: string;
  keywords: string[];
  toneOfVoice: string;
  contentFormat: string;
};

const NICHES = [
  "Fitness & Health", "Business & Finance", "Motivation", "Beauty & Fashion",
  "Food & Cooking", "Travel", "Education", "Entertainment", "Tech",
  "Real Estate", "Parenting", "Lifestyle", "Music & Arts", "Gaming",
];

const GOALS = [
  "Grow my followers", "Drive traffic to my link", "Sell a product",
  "Build authority in my niche", "Get brand deals",
  "Grow engagement & comments", "Promote a service", "Build a community",
];

const ANGLES = [
  "Direct improvement (better version)",
  "Contrarian take (opposite opinion)",
  "Personal story angle",
  "Authority / data-driven",
  "Curiosity gap / tease",
  "Trending sound / format adaptation",
  "Niche-specific adaptation (apply to MY niche)",
];

const TONES = [
  "Motivational & energetic", "Professional & authoritative",
  "Friendly & conversational", "Educational & informative",
  "Funny & entertaining", "Vulnerable & authentic",
];

const FORMATS = [
  "Reel script", "Carousel structure", "Caption only",
  "All formats", "Match source format",
];

const STORAGE_KEY = "igcloner_preferences";

function loadSaved(): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function PreferencePanel({
  onSubmit,
  loading,
}: {
  onSubmit: (prefs: UserPreferences) => void;
  loading?: boolean;
}) {
  const [niche, setNiche] = useState<string>("");
  const [otherNiche, setOtherNiche] = useState("");
  const [contentGoal, setContentGoal] = useState<string>("");
  const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState<string>("");
  const [contentFormat, setContentFormat] = useState<string>("Match source format");

  useEffect(() => {
    const saved = loadSaved();
    if (!saved) return;
    setNiche(saved.niche || "");
    setContentGoal(saved.contentGoal || "");
    setSelectedAngles(saved.selectedAngles || []);
    setTargetAudience(saved.targetAudience || "");
    setKeywords(saved.keywords || []);
    setToneOfVoice(saved.toneOfVoice || "");
    setContentFormat(saved.contentFormat || "Match source format");
  }, []);

  const toggleAngle = (a: string) => {
    setSelectedAngles((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (!k || keywords.includes(k)) return;
    setKeywords([...keywords, k]);
    setKeywordInput("");
  };

  const handleGenerate = () => {
    const finalNiche = niche === "Other" ? otherNiche.trim() : niche;
    if (!finalNiche || !contentGoal || !toneOfVoice) return;
    const prefs: UserPreferences = {
      niche: finalNiche,
      contentGoal,
      selectedAngles: selectedAngles.length ? selectedAngles : ["Direct improvement (better version)"],
      targetAudience,
      keywords,
      toneOfVoice,
      contentFormat,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
    onSubmit(prefs);
  };

  const canSubmit = (niche === "Other" ? otherNiche.trim() : niche) && contentGoal && toneOfVoice;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-ig">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-secondary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-accent-primary">Step 2 · Tailor to your brand</span>
        </div>
        <h2 className="text-xl font-bold leading-tight tracking-tight">Now let's create <span className="gradient-text">YOUR</span> content</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">
          Tell us about your account so we generate content that actually fits your brand — not just the source post's niche.
        </p>
      </div>

      <Section label="Your niche / content category">
        <Select value={niche} onValueChange={setNiche}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select a niche" /></SelectTrigger>
          <SelectContent>
            {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            <SelectItem value="Other">Other (specify)</SelectItem>
          </SelectContent>
        </Select>
        {niche === "Other" && (
          <Input
            className="mt-2"
            placeholder="Describe your niche..."
            value={otherNiche}
            onChange={(e) => setOtherNiche(e.target.value)}
          />
        )}
      </Section>

      <Section label="Your content goal">
        <Select value={contentGoal} onValueChange={setContentGoal}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select a goal" /></SelectTrigger>
          <SelectContent>
            {GOALS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section label="Content angle (select all that apply)">
        <div className="flex flex-wrap gap-2">
          {ANGLES.map((a) => (
            <Pill key={a} active={selectedAngles.includes(a)} onClick={() => toggleAngle(a)}>{a}</Pill>
          ))}
        </div>
      </Section>

      <Section label="Your target audience (optional)">
        <Textarea
          placeholder='e.g. "Women 25-40 building online businesses..."'
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          rows={2}
        />
      </Section>

      <Section label="Keywords to include (optional)">
        <div className="mb-2 flex flex-wrap gap-2">
          {keywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary">
              {k}
              <button onClick={() => setKeywords(keywords.filter((x) => x !== k))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add keyword..."
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
          />
          <Button type="button" variant="outline" onClick={addKeyword}>Add</Button>
        </div>
      </Section>

      <Section label="Tone of voice">
        <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Pick a tone" /></SelectTrigger>
          <SelectContent>
            {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Section label="Content format to generate">
        <Select value={contentFormat} onValueChange={setContentFormat}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Pick a format" /></SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </Section>

      <Button
        onClick={handleGenerate}
        disabled={!canSubmit || loading}
        className="mt-6 h-12 w-full gap-2 rounded-full text-base font-semibold gradient-accent text-white border-0 hover:opacity-95"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Crafting your content..." : "Generate My Content"}
      </Button>
      {!canSubmit && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Pick a niche, goal, and tone to continue.</p>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.10em] text-accent-primary">{label}</p>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all ${
        active
          ? "border-transparent bg-accent-primary text-white shadow-sm"
          : "border-border bg-card text-text-secondary hover:border-accent-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}