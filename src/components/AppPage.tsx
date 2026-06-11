import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link, Sparkles, Copy, Check, Save, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { analyzeInstagramPost } from "@/lib/analyze.functions";

const PLACEHOLDERS = [
  "instagram.com/reel/...",
  "instagram.com/p/...",
  "instagram.com/carousel/...",
];

function detectPostType(url: string): string | null {
  if (!url.includes("instagram.com")) return null;
  if (url.includes("/reel/")) return "Reel";
  if (url.includes("/p/")) return "Post";
  if (url.includes("/carousel/")) return "Carousel";
  return "Post";
}

export function AppPage() {
  const navigate = useNavigate();
  const analyzeFn = useServerFn(analyzeInstagramPost);
  const [url, setUrl] = useState("");
  const [postType, setPostType] = useState<string | null>(null);
  const [phase, setPhase] = useState<"input" | "analyzing" | "results">("input");
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [dna, setDna] = useState<any>(null);
  const [clones, setClones] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [credits, setCredits] = useState(12);
  const [user, setUser] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const type = detectPostType(url);
    setPostType(type);
  }, [url]);

  const handleAnalyze = async () => {
    if (!url.includes("instagram.com")) {
      toast.error("Please enter a valid Instagram URL");
      return;
    }
    if (credits <= 0) {
      toast.error("No credits remaining. Upgrade to continue.");
      return;
    }

    setPhase("analyzing");
    setProgress(0);
    setStepLabel("Detecting post type...");

    // Animate progress while the real request runs
    const steps = [
      { pct: 15, label: "Detecting post type..." },
      { pct: 35, label: "Scraping Instagram post..." },
      { pct: 55, label: "Analyzing hook structure..." },
      { pct: 75, label: "Deconstructing content DNA..." },
      { pct: 90, label: "Generating clone versions..." },
    ];
    let stepIdx = 0;
    const progressTimer = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].pct);
        setStepLabel(steps[stepIdx].label);
        stepIdx++;
      }
    }, 1500);

    try {
      const result = await analyzeFn({ data: { url } });
      clearInterval(progressTimer);
      setProgress(100);
      setStepLabel("Complete");
      setDna(result.dna);
      setClones(result.clones);
      setPhase("results");
      setCredits((c) => c - 1);
      toast.success("Analysis complete");
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error(err);
      toast.error(err?.message || "Analysis failed. Please try again.");
      setPhase("input");
    }
    return;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = async () => {
    toast.success("Analysis saved!");
  };

  const emotionColor = (key: string) => {
    const map: Record<string, string> = {
      curiosity: "bg-accent-primary",
      fomo: "bg-accent-secondary",
      trust: "bg-status-success",
      relatability: "bg-chart-4",
      urgency: "bg-status-warning",
      inspiration: "bg-chart-2",
    };
    return map[key] || "bg-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">IGCloner</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
            {credits} analyses left
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/settings" })}>
            Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); navigate({ to: "/" }); }}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        {phase === "input" && (
          <div className="flex flex-col items-center justify-center py-20">
            <h1 className="mb-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Paste any Instagram URL
            </h1>
            <p className="mb-8 text-center text-muted-foreground">
              We'll deconstruct why it works and generate original versions for you.
            </p>

            <div className="relative w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <Link2 className="ml-3 h-5 w-5 text-muted-foreground shrink-0" />
                <Input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button onClick={handleAnalyze} className="shrink-0 gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </Button>
              </div>
              {postType && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-accent-secondary animate-in fade-in slide-in-from-top-1">
                  <span className="h-2 w-2 rounded-full bg-accent-secondary" />
                  Detected: {postType}
                </div>
              )}
              {!postType && url && !url.includes("instagram.com") && (
                <div className="mt-2 text-sm text-status-error animate-in fade-in">
                  Please enter a valid Instagram URL
                </div>
              )}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              You have <span className="font-medium text-foreground">{credits}</span> analyses remaining
            </p>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="mx-auto max-w-xl py-20">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-accent-primary animate-spin" />
                </div>
                <div>
                  <p className="font-medium">Analyzing content</p>
                  <p className="text-sm text-muted-foreground">{stepLabel}</p>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Usually done in 8–12 seconds</p>
            </div>
          </div>
        )}

        {phase === "results" && dna && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* LEFT: DNA Panel */}
            <div className="space-y-4">
              {/* Post Header Card */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/10">
                      <Sparkles className="h-5 w-5 text-accent-primary" />
                    </div>
                    <div>
                      <p className="font-medium">@{dna.sourceAccount || "source_account"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 text-xs font-medium text-accent-secondary">
                          {dna.contentCategory}
                        </span>
                        <span>{dna.postType || "Reel"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-accent-primary">{dna.performanceScore}</div>
                    <div className="text-xs text-muted-foreground">Performance Score</div>
                  </div>
                </div>
              </div>

              {/* Content Summary */}
              <DNA_card title="Content Summary">
                <p className="text-sm leading-relaxed text-secondary-foreground">{dna.contentSummary}</p>
              </DNA_card>

              {/* Why This Works */}
              <DNA_card title="Why This Works">
                <ul className="space-y-2">
                  {dna.whyItWorks.map((point: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-secondary-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </DNA_card>

              {/* Target Audience */}
              <DNA_card title="Target Audience">
                <div className="grid gap-3 sm:grid-cols-3">
                  <AudiencePill label="WHO" value={dna.targetAudience.who} />
                  <AudiencePill label="DESIRE" value={dna.targetAudience.desire} />
                  <AudiencePill label="TRIGGER" value={dna.targetAudience.trigger} />
                </div>
              </DNA_card>

              {/* Hook Breakdown */}
              <DNA_card title="Hook Breakdown">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-md bg-accent-primary/10 px-2 py-0.5 text-xs font-medium text-accent-primary">
                    {dna.hookBreakdown.type}
                  </span>
                  <span className="font-mono text-sm font-bold text-accent-primary">{dna.hookBreakdown.score}/10</span>
                </div>
                <p className="mb-2 text-sm text-secondary-foreground"><strong>What works:</strong> {dna.hookBreakdown.whatWorks}</p>
                <p className="text-sm text-muted-foreground"><strong>Could improve:</strong> {dna.hookBreakdown.improvement}</p>
              </DNA_card>

              {/* Emotional Architecture */}
              <DNA_card title="Emotional Architecture">
                <div className="space-y-3">
                  {Object.entries(dna.emotionalArchitecture as Record<string, number>).map(([key, value], i) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-20 text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${emotionColor(key)} transition-all duration-700`}
                          style={{ width: `${value}%`, transitionDelay: `${i * 80}ms` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </DNA_card>

              {/* Story Structure */}
              <DNA_card title="Story Structure">
                <div className="space-y-2">
                  {dna.storyStructure.map((section: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-xs font-bold text-accent-primary">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{section.section}</p>
                        <p className="text-xs text-muted-foreground">{section.timing} — {section.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DNA_card>

              {/* Caption DNA */}
              <DNA_card title="Caption DNA">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Structure</span><span className="font-medium">{dna.captionDNA.structure}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tone</span><span className="font-medium">{dna.captionDNA.tone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Persuasion</span><span className="font-medium">{dna.captionDNA.persuasionStyle}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CTA Type</span><span className="font-medium">{dna.captionDNA.ctaType}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-mono font-bold text-accent-primary">{dna.captionDNA.score}/10</span></div>
                </div>
              </DNA_card>

              {/* Visual Style */}
              <DNA_card title="Visual Style">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Color Mood</span><span className="font-medium">{dna.visualStyle.colorMood}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Composition</span><span className="font-medium">{dna.visualStyle.composition}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Text Overlay</span><span className="font-medium">{dna.visualStyle.textOverlay}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Edit Style</span><span className="font-medium">{dna.visualStyle.editStyle}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-mono font-bold text-accent-primary">{dna.visualStyle.score}/10</span></div>
                </div>
              </DNA_card>

              {/* Engagement Drivers */}
              <DNA_card title="Engagement Drivers">
                <ul className="space-y-2">
                  {dna.engagementDrivers.map((driver: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-secondary-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-status-success" />
                      {driver}
                    </li>
                  ))}
                </ul>
              </DNA_card>

              {/* Monetization */}
              <DNA_card title="Monetization Potential">
                <p className="text-sm leading-relaxed text-secondary-foreground">{dna.monetizationPotential}</p>
              </DNA_card>
            </div>

            {/* RIGHT: Clone Engine Panel */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-bold">Your Content Clones</h2>
                <p className="text-sm text-muted-foreground">5 original versions. Same strategy. Your voice.</p>

                <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
                  {clones.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveVersion(i)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        activeVersion === i
                          ? "bg-accent-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      V{c.versionNumber}
                    </button>
                  ))}
                </div>

                {clones[activeVersion] && (
                  <div className="mt-4 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-accent-primary">{clones[activeVersion].angleLabel}</p>
                    </div>

                    <CloneField icon="🪝" label="HOOK" text={clones[activeVersion].hook} />
                    <CloneField icon="📐" label="ANGLE" text={clones[activeVersion].angle} />
                    <CloneField icon="📖" label="STORY STRUCTURE" text={clones[activeVersion].storyStructure} />
                    <CloneField icon="💬" label="CAPTION" text={clones[activeVersion].caption} />
                    <CloneField icon="👁" label="VISUAL DIRECTION" text={clones[activeVersion].visualDirection} />
                    <CloneField icon="📣" label="CTA" text={clones[activeVersion].cta} />

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopy(clones[activeVersion].caption)}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy All
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DNA_card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-all hover:border-border-strong">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function AudiencePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm text-secondary-foreground">{value}</p>
    </div>
  );
}

function CloneField({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{icon} {label}</p>
      <p className="text-sm leading-relaxed text-secondary-foreground whitespace-pre-line">{text}</p>
    </div>
  );
}
