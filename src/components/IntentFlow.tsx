import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Check, Film, LayoutGrid, ImageIcon,
  Upload, X, FileText, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateAngles, setDefaultNiche, type Angle } from "@/lib/angles.functions";
import { uploadReferenceImage } from "@/lib/reference-upload.functions";
import { createProject } from "@/lib/projects.functions";
import { POST_GOALS, type PostGoal } from "@/lib/post-goals";
import { PLATFORM_LIST, type SocialPlatform } from "@/lib/platform-voice";

type CloneMethod = "A1" | "A2" | "A3";
type OutputFormat = "image" | "reel" | "carousel";

const NICHES = [
  "Fitness & Health", "Business & Finance", "Beauty & Fashion", "Food & Cooking",
  "Travel", "Motivation & Mindset", "Education", "Real Estate",
  "Entertainment", "Tech & Gaming", "Parenting", "Lifestyle",
  "Music & Arts", "Sports",
];
const TONES = [
  "Motivational & high energy", "Professional & authoritative", "Friendly & conversational",
  "Educational & informative", "Raw & authentic", "Funny & entertaining",
  "Vulnerable & personal", "Bold & provocative",
];

const CLONE_METHODS: { id: CloneMethod; title: string; blurb: string }[] = [
  { id: "A1", title: "Clone the image exactly with different words", blurb: "Keep the same visual style, composition, colors, and aesthetic. Change the caption, hook, and message." },
  { id: "A2", title: "Clone the text — use a different image", blurb: "Keep the same hook, caption structure, and message format. Use a completely new visual concept." },
  { id: "A3", title: "Use the theme and generate original content", blurb: "Same concept, emotional genre, and niche. Completely original execution in your style." },
];

const OUTPUT_FORMATS: { id: OutputFormat; title: string; icon: React.ReactNode; desc: string }[] = [
  { id: "image", title: "Image", icon: <ImageIcon className="h-5 w-5" />, desc: "Single image post with caption" },
  { id: "reel", title: "Reel", icon: <Film className="h-5 w-5" />, desc: "Short video script + VEO 3 + voiceover" },
  { id: "carousel", title: "Carousel", icon: <LayoutGrid className="h-5 w-5" />, desc: "Slide deck ready to build in Canva" },
];

const CLONE_SUMMARY: Record<CloneMethod, string> = {
  A1: "Clone the source post's visual style; deliver a new message.",
  A2: "Clone the caption/hook structure; pair it with a new visual.",
  A3: "Use the source as inspiration; create something fully original.",
};

const STORAGE_KEY = "igcloner.preferences.v1";

type UploadedImage = { url: string; name: string };
type UploadedDoc = { name: string; text: string };

type Props = { analysisId: string };

export function IntentFlow({ analysisId }: Props) {
  const navigate = useNavigate();
  const genFn = useServerFn(generateAngles);
  const nicheFn = useServerFn(setDefaultNiche);
  const createFn = useServerFn(createProject);
  const uploadFn = useServerFn(uploadReferenceImage);

  const [cloneMethod, setCloneMethod] = useState<CloneMethod>("A1");
  const [outputFormat, setOutputFormat] = useState<OutputFormat | null>(null);
  const [niche, setNiche] = useState<string | null>(null);
  const [customNiche, setCustomNiche] = useState("");
  const [goal, setGoal] = useState<PostGoal | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(["instagram"]);
  const [tone, setTone] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [audience, setAudience] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [angles, setAngles] = useState<Angle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [openingFormat, setOpeningFormat] = useState<string | null>(null);

  const prefsRef = useRef<HTMLDivElement>(null);
  const anglesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore saved prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v.niche) setNiche(v.niche);
      if (v.goal) setGoal(v.goal);
      if (v.tone) setTone(v.tone);
      if (Array.isArray(v.keywords)) setKeywords(v.keywords);
      if (typeof v.audience === "string") setAudience(v.audience);
    } catch {}
  }, []);

  useEffect(() => {
    if (cloneMethod && outputFormat && prefsRef.current) {
      prefsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [cloneMethod, outputFormat]);
  useEffect(() => {
    if (angles && anglesRef.current) {
      anglesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [angles]);
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = setInterval(() => setLoadingStep((s) => (s < 4 ? s + 1 : s)), 1600);
    return () => clearInterval(id);
  }, [loading]);

  const selectedNiche = niche === "__custom__" ? customNiche.trim() : niche;
  const canGenerate = !!cloneMethod && !!outputFormat && !!selectedNiche && !!goal && !loading;

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (!k) return;
    setKeywords((prev) => Array.from(new Set([...prev, k])).slice(0, 12));
    setKeywordInput("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is over 10MB`); continue; }
          const b64 = await fileToBase64(file);
          const res = await uploadFn({
            data: { analysisId, filename: file.name, mediaType: file.type, dataBase64: b64 },
          });
          setUploadedImages((prev) => [...prev, { url: res.url, name: file.name }].slice(0, 3));
        } else if (
          file.type === "text/plain" ||
          file.type === "text/markdown" ||
          /\.(txt|md)$/i.test(file.name)
        ) {
          if (file.size > 200 * 1024) { toast.error(`${file.name} is over 200KB`); continue; }
          const text = await file.text();
          setUploadedDocs((prev) => [...prev, { name: file.name, text: text.slice(0, 8000) }].slice(0, 3));
        } else {
          toast.error(`${file.name}: only images and .txt/.md are supported`);
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const generate = async () => {
    if (!cloneMethod || !outputFormat || !selectedNiche || !goal) return;
    setLoading(true);
    setAngles(null);
    setSelectedIdx(null);
    try {
      // persist prefs for next session
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          niche, goal, tone, keywords, audience, cloneMethod, outputFormat,
        }));
      } catch {}
      const docText = uploadedDocs.length
        ? uploadedDocs.map((d) => `=== ${d.name} ===\n${d.text}`).join("\n\n").slice(0, 8000)
        : undefined;
      const res: any = await genFn({
        data: {
          analysisId,
          niche: selectedNiche,
          intent: cloneMethod,
          outputFormat,
          preferences: {
            contentGoal: goal,
            toneOfVoice: tone ?? undefined,
            keywords,
            targetAudience: audience || undefined,
            userDescription: description || undefined,
            uploadedImageUrls: uploadedImages.map((i) => i.url),
            uploadedDocumentText: docText,
          },
        },
      });
      setAngles(res.angles);
      nicheFn({ data: { niche: selectedNiche } }).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate angles");
    } finally {
      setLoading(false);
    }
  };

  const openStudio = async () => {
    if (selectedIdx === null || !angles || !outputFormat) return;
    const format = outputFormat;
    const angle = angles[selectedIdx];
    setOpeningFormat(format);
    const target = format === "reel" ? "/studio/reel" : format === "carousel" ? "/studio/carousel" : "/studio/image";
    try {
      const res: any = await createFn({
        data: {
          analysisId,
          format,
          title: `${angle.angleName} — ${angle.hookLine.slice(0, 60)}`,
          userPreferences: {
            intent: cloneMethod,
            cloneMethod,
            outputFormat,
            niche: selectedNiche ?? undefined,
            contentGoal: goal ?? undefined,
            goal: goal ?? undefined,
            selectedPlatforms,
            toneOfVoice: tone ?? undefined,
            keywords,
            targetAudience: audience || undefined,
            userDescription: description || undefined,
            uploadedImageUrls: uploadedImages.map((i) => i.url),
            angle: angle.hookLine,
            angleName: angle.angleName,
            angleConcept: angle.concept,
            angleType: angle.angleType,
            hookType: angle.hookType,
            specificSourceElement: angle.specificSourceElement,
            sourceConnection: angle.sourceConnection,
            contentDirection: angle.contentDirection,
          },
        },
      });
      navigate({ to: target as any, search: { projectId: res.project.id } as any });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't open studio");
      setOpeningFormat(null);
    }
  };

  const restart = () => {
    setAngles(null);
    setSelectedIdx(null);
  };

  return (
    <div className="space-y-6">
      {/* CONNECTED PREFERENCE PANEL */}
      {!angles && (
        <div ref={prefsRef} className="scroll-mt-4 rounded-2xl border border-border bg-card p-5 shadow-ig space-y-5">
          {/* STEP 1 — clone method */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">Step 1 of 2</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">How do you want to clone this content?</h2>
            <div className="mt-3 space-y-2">
              {CLONE_METHODS.map((m) => {
                const active = cloneMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setCloneMethod(m.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      active ? "border-transparent ring-2 ring-accent-primary bg-accent-primary/5" : "border-border bg-card hover:border-strong"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-accent-primary" : "border-muted-foreground/40"}`}>
                      {active && <span className="h-2 w-2 rounded-full bg-accent-primary" />}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">{m.id}</span>
                        {m.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* STEP 2 — output format */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">Step 2 of 2</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">What do you want to create?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {OUTPUT_FORMATS.map((f) => {
                const active = outputFormat === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOutputFormat(f.id)}
                    className={`relative rounded-xl border p-4 text-left transition-all ${
                      active ? "border-transparent ring-2 ring-accent-primary bg-accent-primary/5" : "border-border bg-card hover:border-strong"
                    }`}
                  >
                    {active && (
                      <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
                      {f.icon}
                    </div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Creative brief summary */}
          {cloneMethod && outputFormat && (
            <div className="rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-3 text-xs leading-relaxed">
              <p className="font-semibold uppercase tracking-widest text-[10px] text-accent-primary">Your creative brief</p>
              <p className="mt-1.5 text-foreground">
                <span className="font-semibold">{cloneMethod} + {OUTPUT_FORMATS.find(f => f.id === outputFormat)?.title}</span> — {CLONE_SUMMARY[cloneMethod]} Output: {outputFormat}.
              </p>
            </div>
          )}

          <div className="border-t border-border" />

          {/* Advanced Features wrapper (collapsed by default for A1) */}
          {cloneMethod === "A1" && (
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-strong transition-colors"
              aria-expanded={advancedOpen}
            >
              <div>
                <p className="text-sm font-semibold">Advanced Features</p>
                <p className="text-xs text-muted-foreground">Niche, goal, tone, keywords, audience, extra context</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            </button>
          )}

          {/* Goal — always visible & required (drives copy direction) */}
          <Section title="What is the goal of this post?" required>
            <p className="mb-2 text-[11px] text-muted-foreground">
              This shapes your captions, hooks, and CTAs to actually achieve it.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {POST_GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-transparent bg-accent-primary/5 ring-2 ring-accent-primary"
                        : "border-border bg-card hover:border-strong"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      <span className="mr-1.5">{g.emoji}</span>
                      {g.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{g.description}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          <div className={cloneMethod === "A1" && !advancedOpen ? "hidden" : "space-y-5"}>
          {/* Niche */}
          <Section title="Your niche" required>
            <ChipGrid
              options={NICHES}
              selected={niche && niche !== "__custom__" ? niche : null}
              onSelect={(v) => { setNiche(v); setCustomNiche(""); }}
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                value={customNiche}
                onChange={(e) => { setCustomNiche(e.target.value); setNiche("__custom__"); }}
                placeholder="Or type your own niche…"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              />
            </div>
          </Section>

          {/* Tone */}
          <Section title="Tone of voice">
            <ChipGrid options={TONES} selected={tone} onSelect={setTone} />
          </Section>

          {/* Keywords */}
          <Section title="Keywords & topics (optional)">
            <div className="flex flex-wrap items-center gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2 py-1 text-xs text-accent-primary">
                  {k}
                  <button onClick={() => setKeywords((p) => p.filter((x) => x !== k))} aria-label="remove">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="+ add keyword"
                className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Product name, trending topic, brand phrase, signature words…</p>
          </Section>

          {/* Audience */}
          <Section title="Your target audience (optional)">
            <textarea
              value={audience}
              onChange={(e) => setAudience(e.target.value.slice(0, 1000))}
              placeholder='e.g. "Women 30-45 trying to lose weight without giving up the foods they love."'
              className="min-h-[72px] w-full rounded-lg border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            />
          </Section>

          {/* Free-form + uploads */}
          <Section title="Give the AI more context (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 3000))}
              placeholder='Type instructions, keywords, references, brand voice notes…'
              className="min-h-[120px] w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,text/plain,text/markdown"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-strong disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload image or .txt
              </button>
              <span className="text-[11px] text-muted-foreground">
                Images (max 10MB) used as visual reference · .txt/.md (max 200KB) as text context
              </span>
            </div>
            {(uploadedImages.length > 0 || uploadedDocs.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uploadedImages.map((img) => (
                  <span key={img.url} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px]">
                    <ImageIcon className="h-3 w-3" />{img.name}
                    <button onClick={() => setUploadedImages((p) => p.filter((x) => x.url !== img.url))} aria-label="remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {uploadedDocs.map((d) => (
                  <span key={d.name} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px]">
                    <FileText className="h-3 w-3" />{d.name}
                    <button onClick={() => setUploadedDocs((p) => p.filter((x) => x.name !== d.name))} aria-label="remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Section>
          </div>

          {/* Generate */}
          <div className="mt-5 border-t border-border pt-4">
            <Button
              onClick={generate}
              disabled={!canGenerate}
              className="h-12 w-full gap-2 text-base font-semibold"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              Generate My 5 Viral {outputFormat ? OUTPUT_FORMATS.find(f => f.id === outputFormat)?.title : ""} Angles
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Clone: {cloneMethod} ✓{"  ·  "}
              Format: {outputFormat ? <span>{outputFormat} ✓</span> : <span className="text-status-error">format required</span>}{"  ·  "}
              {selectedNiche ? `Niche: ${selectedNiche} ✓` : <span className="text-status-error">Niche required</span>}{"  ·  "}
              {goal ? `Goal: ${goal} ✓` : <span className="text-status-error">Goal required</span>}
            </p>
          </div>
        </div>
      )}

      {loading && <AnglesLoading step={loadingStep} niche={selectedNiche} intent={cloneMethod} />}

      {/* STEP 5: ANGLES */}
      {angles && (
        <div ref={anglesRef} className="space-y-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                5 viral {outputFormat} angles for your <span className="gradient-text">{selectedNiche}</span> content
              </h2>
              <p className="text-xs text-muted-foreground">Clone method {cloneMethod} · Format {outputFormat}. Pick one to open the studio.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={restart}>← Change preferences</Button>
              <Button variant="outline" size="sm" onClick={generate} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {angles.map((a, i) => {
              const selected = selectedIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`relative rounded-xl border p-4 text-left transition-all ${
                    selected
                      ? "border-transparent bg-card ring-2 ring-accent-primary shadow-md"
                      : "border-border bg-card hover:border-strong"
                  }`}
                >
                  {selected && (
                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">
                      Angle {a.angleNumber} · {a.angleName}
                    </span>
                    <span className="font-mono text-xs font-semibold">{a.viralPotential}/100</span>
                  </div>
                  <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
                      style={{ width: `${a.viralPotential}%` }}
                    />
                  </div>
                  <div className="rounded-md border border-accent-primary/20 bg-accent-primary/5 px-2 py-1.5 text-[11px] leading-snug text-secondary-foreground">
                    <span className="font-semibold text-accent-primary">💡 FROM THE SOURCE: </span>
                    {a.sourceConnection}
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-snug gradient-text">"{a.hookLine}"</p>
                  {a.contentDirection && (
                    <p className="mt-2 text-xs text-secondary-foreground">{a.contentDirection}</p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">{a.whyItWillPerform}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 font-medium text-accent-secondary capitalize">
                      Format: {outputFormat}
                    </span>
                    <span className="text-muted-foreground">{a.hookType}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedIdx !== null && outputFormat && (
            <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold">Ready to build "{angles[selectedIdx].angleName}"</p>
                  <p className="text-xs text-muted-foreground">Opens the {outputFormat} studio with this angle and your preferences pre-loaded.</p>
                </div>
                <Button onClick={openStudio} disabled={!!openingFormat} className="gap-2">
                  {openingFormat ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening…</> : <>Open {outputFormat} Studio <Sparkles className="h-4 w-4" /></>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {openingFormat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-6 shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
            <p className="text-sm font-medium">Opening {openingFormat} studio…</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function Section({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title} {required && <span className="text-status-error">*</span>}
      </p>
      {children}
    </div>
  );
}

function ChipGrid({ options, selected, onSelect }: { options: string[]; selected: string | null; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onSelect(o)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              active
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary font-semibold"
                : "border-border bg-card text-foreground hover:border-strong"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function AnglesLoading({ step, niche, intent }: { step: number; niche: string | null; intent: string | null }) {
  const steps = [
    "Re-reading the source post…",
    `Applying intent ${intent ?? ""}…`,
    `Crafting angles for ${niche ?? "your niche"}…`,
    "Writing ready-to-post hooks…",
    "Scoring viral potential…",
  ];
  return (
    <div className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-6">
      <div className="mb-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
        <p className="text-sm font-semibold">Generating your 5 viral angles…</p>
      </div>
      <ul className="space-y-2">
        {steps.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={i} className={`flex items-center gap-2 text-xs transition ${done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground/60"}`}>
              {done ? <Check className="h-3.5 w-3.5 text-accent-primary" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-primary" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
              {label}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">This takes about 8 seconds.</p>
    </div>
  );
}