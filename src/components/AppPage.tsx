import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Copy, Check, Loader2, Link2, AlertCircle, Wand2, X, Zap, Shuffle, Send, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  analyzeInstagramPost,
  getAnalysisById,
  getUsage,
  makeItBetter,
  generateHooks,
  multiplyContent,
  regenerateClonesWithPreferences,
} from "@/lib/analyze.functions";
import { ChannelIntelHeader } from "@/components/ChannelIntelHeader";
import { PreferencePanel, type UserPreferences } from "@/components/PreferencePanel";
import { PostThisModal, type CloneForPost } from "@/components/PostThisModal";

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
  const search = useSearch({ from: "/_authenticated/app" });
  const analyzeFn = useServerFn(analyzeInstagramPost);
  const loadFn = useServerFn(getAnalysisById);
  const usageFn = useServerFn(getUsage);
  const improveFn = useServerFn(makeItBetter);
  const hooksFn = useServerFn(generateHooks);
  const multiplyFn = useServerFn(multiplyContent);
  const regenFn = useServerFn(regenerateClonesWithPreferences);
  const [url, setUrl] = useState("");
  const [postType, setPostType] = useState<string | null>(null);
  const [phase, setPhase] = useState<"input" | "analyzing" | "results">("input");
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [dna, setDna] = useState<any>(null);
  const [clones, setClones] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number; plan: string } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [savedBadge, setSavedBadge] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improvedMap, setImprovedMap] = useState<Record<number, { improvements: string[]; shareabilityScore: number; savePotentialScore: number }>>({});
  const [rightTab, setRightTab] = useState<"clones" | "multiplier" | "hooks">("clones");
  const [hooks, setHooks] = useState<{ type: string; text: string; why: string }[]>([]);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [multiplyLoading, setMultiplyLoading] = useState<string | null>(null);
  const [multiplied, setMultiplied] = useState<Record<string, string>>({});
  const [scraped, setScraped] = useState<any>(null);
  const [instagramUrl, setInstagramUrl] = useState<string>("");
  const [showPreferences, setShowPreferences] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [activePreferences, setActivePreferences] = useState<UserPreferences | null>(null);
  const [postModal, setPostModal] = useState<CloneForPost | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await usageFn()); } catch {}
  }, [usageFn]);

  useEffect(() => { refreshUsage(); }, [refreshUsage]);

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

  useEffect(() => {
    const id = (search as any)?.analysisId as string | undefined;
    if (!id || id === analysisId) return;
    (async () => {
      try {
        setPhase("analyzing");
        setProgress(60);
        setStepLabel("Loading saved analysis...");
        const res = await loadFn({ data: { id } });
        setDna(res.dna);
        setClones(res.clones);
        setScraped((res as any).scraped ?? null);
        setInstagramUrl((res as any).instagramUrl ?? "");
        setAnalysisId(res.analysisId);
        setSavedBadge(res.createdAt ? new Date(res.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Saved");
        setPhase("results");
      } catch (e: any) {
        toast.error(e?.message || "Couldn't load that analysis");
        setPhase("input");
      }
    })();
  }, [search, analysisId, loadFn]);

  const handleAnalyze = async () => {
    if (!url.includes("instagram.com")) {
      toast.error("Please enter a valid Instagram URL");
      return;
    }
    if (usage && usage.remaining <= 0) {
      setShowUpgrade(true);
      return;
    }

    setPhase("analyzing");
    setProgress(0);
    setStepLabel("Reading post URL...");
    setSavedBadge(null);
    setFallbackMode(false);
    setImprovedMap({});

    const steps = [
      { pct: 12, label: "Reading post URL..." },
      { pct: 28, label: "Fetching post data..." },
      { pct: 48, label: "Analyzing hook structure..." },
      { pct: 66, label: "Mapping emotional architecture..." },
      { pct: 82, label: "Generating DNA report..." },
      { pct: 94, label: "Building your clones..." },
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
      console.log("[analyze] calling server fn", { url });
      const result: any = await analyzeFn({ data: { url } });
      console.log("[analyze] server fn response", result);
      clearInterval(progressTimer);
      if (!result) {
        toast.error("Analysis failed. Please try again.");
        setPhase("input");
        return;
      }
      if (result?.limitReached) {
        setShowUpgrade(true);
        setPhase("input");
        return;
      }
      if (result?.ok === false || !result?.data) {
        toast.error(result?.error || "Analysis failed. Please try again.");
        setPhase("input");
        return;
      }
      const payload = result.data;
      setProgress(100);
      setStepLabel("Complete");
      setDna(payload?.dna ?? null);
      setClones(payload?.clones ?? []);
      setScraped(payload?.scraped ?? null);
      setInstagramUrl(payload?.instagramUrl ?? url);
      setAnalysisId(payload?.analysisId ?? null);
      setFallbackMode(Boolean(payload?.fallback));
      setPhase("results");
      setShowPreferences(true);
      setActivePreferences(null);
      toast.success("Saved to your dashboard");
      refreshUsage();
    } catch (err: any) {
      clearInterval(progressTimer);
      const msg: string = err?.message || "Analysis failed. Please try again.";
      console.error("[analyze] threw", err);
      if (/LIMIT_REACHED/.test(msg)) setShowUpgrade(true);
      else toast.error(msg);
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

  const handleMakeBetter = async () => {
    if (!analysisId || !clones[activeVersion]) return;
    setImproving(true);
    try {
      const versionNumber = clones[activeVersion].versionNumber;
      const res = await improveFn({ data: { analysisId, versionNumber } });
      const imp = res.improved;
      setClones((prev) => prev.map((c, i) =>
        i === activeVersion
          ? { ...c, hook: imp.improvedHook, caption: imp.improvedCaption, cta: imp.improvedCta, improved: true }
          : c,
      ));
      setImprovedMap((m) => ({
        ...m,
        [versionNumber]: {
          improvements: imp.improvements || [],
          shareabilityScore: imp.shareabilityScore ?? 0,
          savePotentialScore: imp.savePotentialScore ?? 0,
        },
      }));
      toast.success("Upgraded");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't improve this version");
    } finally {
      setImproving(false);
    }
  };

  const handleGeneratePreferences = async (prefs: UserPreferences) => {
    if (!analysisId) {
      toast.error("No analysis to attach preferences to");
      return;
    }
    setRegenerating(true);
    try {
      const res = await regenFn({ data: { analysisId, preferences: prefs } });
      setClones(res.clones);
      setActiveVersion(0);
      setActivePreferences(prefs);
      setShowPreferences(false);
      setRightTab("clones");
      toast.success(`Generated ${res.clones.length} clones for ${prefs.niche}`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate tailored clones");
    } finally {
      setRegenerating(false);
    }
  };

  const handleGenerateHooks = async () => {
    if (!analysisId) return;
    setHooksLoading(true);
    try {
      const res = await hooksFn({ data: { analysisId } });
      setHooks(res.hooks || []);
    } catch (e: any) {
      toast.error(e?.message || "Hook Lab failed");
    } finally {
      setHooksLoading(false);
    }
  };

  const handleMultiply = async (format: "tweet" | "twitter_thread" | "linkedin" | "youtube" | "blog") => {
    if (!analysisId) return;
    setMultiplyLoading(format);
    try {
      const versionNumber = clones[activeVersion]?.versionNumber;
      const res = await multiplyFn({ data: { analysisId, format, versionNumber } });
      setMultiplied((m) => ({ ...m, [format]: res.content }));
    } catch (e: any) {
      toast.error(e?.message || "Multiplier failed");
    } finally {
      setMultiplyLoading(null);
    }
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
    <div className="min-h-full">
      {usage && (
        <div className="flex items-center justify-end border-b border-border px-4 py-2 lg:px-8">
          <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {usage.remaining} / {usage.limit} left this month
          </div>
        </div>
      )}

      {usage && usage.remaining > 0 && usage.remaining <= 5 && !dismissedWarning && (
        <div className="flex items-center justify-between gap-3 border-b border-status-warning/30 bg-status-warning/10 px-4 py-2 text-sm text-status-warning lg:px-8">
          <span>⚡ {usage.remaining} analyses left this month · <button onClick={() => navigate({ to: "/settings" })} className="underline underline-offset-2">Upgrade for more →</button></span>
          <button onClick={() => setDismissedWarning(true)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
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

            {usage && (
              <p className="mt-6 text-sm text-muted-foreground">
                You have <span className="font-medium text-foreground">{usage.remaining}</span> of <span className="font-medium text-foreground">{usage.limit}</span> remaining
              </p>
            )}
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
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight gradient-text">Analysis</h2>
              <Button
                size="sm"
                onClick={() => {
                  setUrl("");
                  setDna(null);
                  setClones([]);
                  setScraped(null);
                  setAnalysisId(null);
                  setActivePreferences(null);
                  setShowPreferences(true);
                  setPhase("input");
                  navigate({ to: "/app" });
                }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> New Analysis
              </Button>
            </div>

              {/* Channel intelligence header (media + account intel) */}
              <ChannelIntelHeader scraped={scraped} dna={dna} url={instagramUrl || url} />

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
                        {savedBadge && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">Saved · {savedBadge}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-accent-primary">{dna.performanceScore}</div>
                    <div className="text-xs text-muted-foreground">Performance Score</div>
                  </div>
                </div>
                {fallbackMode && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Limited data mode — analysis based on URL pattern.
                  </div>
                )}
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
                <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
                  {[
                    { key: "clones", label: "Clones" },
                    { key: "multiplier", label: "Multiplier" },
                    { key: "hooks", label: "Hook Lab" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setRightTab(t.key as any)}
                      className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
                        rightTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {rightTab === "clones" && (<>
                {showPreferences ? (
                  <div className="mt-4">
                    <PreferencePanel onSubmit={handleGeneratePreferences} loading={regenerating} />
                  </div>
                ) : (
                <>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">Your Content Clones</h2>
                    {activePreferences ? (
                      <p className="text-sm text-text-secondary">
                        Tailored for <span className="font-semibold text-foreground">{activePreferences.niche}</span> · {activePreferences.toneOfVoice}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">5 original versions. Same strategy. Your voice.</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-accent-primary" onClick={() => setShowPreferences(true)}>
                    <Sparkles className="h-3.5 w-3.5" /> Re-tune
                  </Button>
                </div>

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
                      {c.angleLabel ? c.angleLabel.split(" ").slice(0, 2).join(" ") : `V${c.versionNumber}`}{c.improved ? " ✦" : ""}
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

                    {improvedMap[clones[activeVersion].versionNumber] && (
                      <div className="rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent-primary">✦ What changed</p>
                        <ul className="space-y-1 text-xs text-secondary-foreground">
                          {improvedMap[clones[activeVersion].versionNumber].improvements.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                        <div className="mt-2 flex gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                          <span>Shareability <span className="font-mono text-accent-primary">{improvedMap[clones[activeVersion].versionNumber].shareabilityScore}</span></span>
                          <span>Save Potential <span className="font-mono text-accent-primary">{improvedMap[clones[activeVersion].versionNumber].savePotentialScore}</span></span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopy(clones[activeVersion].caption)}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy All
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={handleMakeBetter} disabled={improving || !analysisId}>
                        {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                        Make It Better
                      </Button>
                      <Button
                        size="sm"
                        className="ml-auto gap-1.5 gradient-accent text-white border-0 hover:opacity-95"
                        onClick={() => setPostModal({
                          versionNumber: clones[activeVersion].versionNumber,
                          angleLabel: clones[activeVersion].angleLabel,
                          hook: clones[activeVersion].hook,
                          caption: clones[activeVersion].caption,
                          cta: clones[activeVersion].cta,
                        })}
                      >
                        <Send className="h-3.5 w-3.5" /> Post This
                      </Button>
                    </div>
                  </div>
                )}
                </>
                )}
                </>)}

                {rightTab === "multiplier" && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2"><Shuffle className="h-4 w-4 text-accent-primary" /> Content Multiplier</h2>
                      <p className="text-sm text-muted-foreground">Repurpose the active clone (V{clones[activeVersion]?.versionNumber ?? "—"}) into other platforms.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "tweet", label: "Tweet" },
                        { key: "twitter_thread", label: "X Thread" },
                        { key: "linkedin", label: "LinkedIn" },
                        { key: "youtube", label: "YouTube" },
                        { key: "blog", label: "Blog" },
                      ].map((f) => (
                        <Button
                          key={f.key}
                          size="sm"
                          variant="outline"
                          className="justify-start gap-2"
                          disabled={multiplyLoading === f.key || !analysisId}
                          onClick={() => handleMultiply(f.key as any)}
                        >
                          {multiplyLoading === f.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          {f.label}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {Object.entries(multiplied).map(([format, content]) => (
                        <div key={format} className="rounded-lg border border-border bg-muted/30 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{format.replace("_", " ")}</p>
                            <button onClick={() => handleCopy(content)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>
                          <Textarea readOnly value={content} className="min-h-[120px] resize-y bg-background text-xs" />
                        </div>
                      ))}
                      {Object.keys(multiplied).length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-6">Pick a format above to generate.</p>
                      )}
                    </div>
                  </div>
                )}

                {rightTab === "hooks" && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold flex items-center gap-2"><Wand2 className="h-4 w-4 text-accent-primary" /> Hook Lab</h2>
                        <p className="text-sm text-muted-foreground">10 hook variations using different patterns.</p>
                      </div>
                      <Button size="sm" disabled={hooksLoading || !analysisId} onClick={handleGenerateHooks} className="gap-1.5 shrink-0">
                        {hooksLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {hooks.length > 0 ? "Regenerate" : "Generate"}
                      </Button>
                    </div>
                    {hooksLoading && hooks.length === 0 && (
                      <div className="space-y-2">
                        {[0,1,2,3,4].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
                      </div>
                    )}
                    {hooks.length > 0 && (
                      <div className="space-y-2">
                        {hooks.map((h, i) => (
                          <div key={i} className="group rounded-lg border border-border bg-muted/30 p-3 hover:border-border-strong">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="rounded-md bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent-primary">{h.type}</span>
                              <button onClick={() => handleCopy(h.text)} className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                                <Copy className="h-3 w-3" /> Copy
                              </button>
                            </div>
                            <p className="text-sm text-secondary-foreground">{h.text}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground italic">{h.why}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hooksLoading && hooks.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-6">Generate to see 10 variations.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={() => { setShowUpgrade(false); navigate({ to: "/settings" }); }} />
      )}
      {postModal && (
        <PostThisModal
          clone={postModal}
          niche={activePreferences?.niche}
          postType={dna?.postType}
          onClose={() => setPostModal(null)}
        />
      )}
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

function UpgradeModal({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">You've used all your free analyses.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Upgrade to keep deconstructing what works.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { name: "Creator", price: "$19", note: "50 analyses / month", features: ["Full DNA analysis", "5 clones per post", "Hook Lab", "Save & history"] },
            { name: "Pro", price: "$49", note: "Unlimited analyses", features: ["Everything in Creator", "Content Multiplier", "30-day Calendar", "Priority generation"] },
          ].map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{p.name}</p>
              <p className="mt-1 text-2xl font-bold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground">{p.note}</p>
              <ul className="my-3 space-y-1 text-xs text-secondary-foreground">
                {p.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
              <Button size="sm" className="w-full" onClick={onUpgrade}>Upgrade Now</Button>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Maybe Later</button>
        </div>
      </div>
    </div>
  );
}
