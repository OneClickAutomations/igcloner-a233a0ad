import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Loader2, Link2, AlertCircle, X, Plus, ChevronDown, ChevronUp, Coins } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { analyzeInstagramPost, getAnalysisById, getAnalysisStatus } from "@/lib/analyze.functions";
import { AnalysisEvidencePanel } from "@/components/AnalysisEvidencePanel";
import { getCreditBalance } from "@/lib/credits.functions";
import { ACTION_COSTS, CREDIT_BALANCE_KEY, parseInsufficientCredits, type InsufficientCreditsInfo } from "@/lib/credits";
import { classifySourceUrl } from "@/lib/source-ingest";
import { listProjects } from "@/lib/projects.functions";
import { ChannelIntelHeader } from "@/components/ChannelIntelHeader";
import { IntentFlow } from "@/components/IntentFlow";
import { DecisionCard } from "@/components/DecisionCard";
import type { ViralScoreResult } from "@/lib/scoring";

const PLACEHOLDERS = [
  "instagram.com/reel/...",
  "instagram.com/p/...",
  "facebook.com/.../posts/...",
  "facebook.com/reel/...",
];

function isSupportedUrl(url: string): boolean {
  return /(instagram\.com|facebook\.com|fb\.watch|fb\.com)/i.test(url);
}

/** Honest type chip: /p/ is "Image or Carousel" until the scrape decides. */
function detectPostType(url: string): string | null {
  if (!isSupportedUrl(url)) return null;
  const c = classifySourceUrl(url.startsWith("http") ? url : `https://${url}`);
  if (!c) return null;
  if (c.shareLink) return "Share link — will resolve";
  if (c.provisional && c.platform === "instagram" && c.kind === "Image") return "Image or Carousel";
  if (c.provisional) return `${c.kind} (will confirm)`;
  return c.kind;
}

export function AppPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/app" });
  const analyzeFn = useServerFn(analyzeInstagramPost);
  const loadFn = useServerFn(getAnalysisById);
  const statusFn = useServerFn(getAnalysisStatus);
  const balanceFn = useServerFn(getCreditBalance);
  const listProjectsFn = useServerFn(listProjects);
  const queryClient = useQueryClient();
  const { data: creditData } = useQuery({
    queryKey: CREDIT_BALANCE_KEY,
    queryFn: () => balanceFn(),
  });
  const creditBalance = creditData?.balance ?? null;

  const [url, setUrl] = useState("");
  const [postType, setPostType] = useState<string | null>(null);
  const [phase, setPhase] = useState<"input" | "analyzing" | "results">("input");
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [dna, setDna] = useState<any>(null);
  const [scraped, setScraped] = useState<any>(null);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [viral, setViral] = useState<ViralScoreResult | null>(null);
  const [observed, setObserved] = useState<{ blueprint: any; transcript: string | null; analysisConfidence: number | null }>({ blueprint: null, transcript: null, analysisConfidence: null });
  const [fallbackMode, setFallbackMode] = useState(false);
  const [savedBadge, setSavedBadge] = useState<string | null>(null);

  const [insufficient, setInsufficient] = useState<InsufficientCreditsInfo | null>(null);

  const [dnaOpen, setDnaOpen] = useState(false);
  const [analysisProjects, setAnalysisProjects] = useState<any[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshCredits = () => queryClient.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY });

  useEffect(() => {
    if (!analysisId) { setAnalysisProjects([]); return; }
    (async () => {
      try {
        const res: any = await listProjectsFn();
        const all = res?.projects ?? [];
        setAnalysisProjects(all.filter((p: any) => p.analysis_id === analysisId));
      } catch {}
    })();
  }, [analysisId, listProjectsFn]);

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setPostType(detectPostType(url)); }, [url]);

  useEffect(() => {
    const id = (search as any)?.analysisId as string | undefined;
    if (!id || id === analysisId) return;
    (async () => {
      try {
        setPhase("analyzing");
        setProgress(60);
        setStepLabel("Loading saved analysis…");
        const res = await loadFn({ data: { id } });
        setDna(res.dna);
        setScraped((res as any).scraped ?? null);
        setInstagramUrl((res as any).instagramUrl ?? "");
        setAnalysisId(res.analysisId);
        setViral((res as any).viral ?? null);
        setObserved({ blueprint: (res as any).blueprint ?? null, transcript: (res as any).transcript ?? null, analysisConfidence: (res as any).analysisConfidence ?? null });
        setSavedBadge(
          res.createdAt
            ? new Date(res.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : "Saved"
        );
        setPhase("results");
      } catch (e: any) {
        toast.error(e?.message || "Couldn't load that analysis");
        setPhase("input");
      }
    })();
  }, [search, analysisId, loadFn]);

  const handleAnalyze = async () => {
    if (!isSupportedUrl(url)) {
      toast.error("Please enter a valid Instagram or Facebook URL");
      return;
    }
    setInsufficient(null);
    setPhase("analyzing");
    setProgress(0);
    setStepLabel("Reading post URL…");
    setFallbackMode(false);
    setSavedBadge(null);

    // Poll the job's real stage while the server works.
    const jobId = crypto.randomUUID();
    const stagePct: Record<string, number> = { fetching_post: 10, saving_media: 25, reading_slides: 40, watching_video: 55, transcribing: 70, building_blueprint: 85 };
    const timer = setInterval(async () => {
      try {
        const st: any = await statusFn({ data: { analysisId: jobId } });
        if (st?.label) { setStepLabel(`${st.label}…`); setProgress(stagePct[st.stage] ?? 10); }
      } catch {}
    }, 2000);

    try {
      const result: any = await analyzeFn({ data: { url, analysisId: jobId } });
      clearInterval(timer);
      if (!result) { toast.error("Analysis failed."); setPhase("input"); return; }
      if (result.ok === false || !result.data) {
        const insuff = parseInsufficientCredits(result.error);
        if (insuff) {
          setInsufficient(insuff);
        } else {
          toast.error(result.error || "Analysis failed.");
        }
        setPhase("input");
        refreshCredits();
        return;
      }
      const p = result.data;
      setProgress(100);
      setStepLabel("Complete");
      setDna(p.dna ?? null);
      setScraped(p.scraped ?? null);
      setInstagramUrl(p.instagramUrl ?? url);
      setAnalysisId(p.analysisId ?? null);
      setViral(p.viral ?? null);
      setObserved({ blueprint: p.blueprint ?? null, transcript: p.transcript ?? null, analysisConfidence: p.analysisConfidence ?? null });
      setFallbackMode(Boolean(p.fallback));
      setPhase("results");
      toast.success(p.cacheHit ? "Loaded your recent analysis of this post — no credits used" : "Saved to your dashboard");
      refreshCredits();
    } catch (err: any) {
      clearInterval(timer);
      const msg: string = err?.message || "Analysis failed.";
      const insuff = parseInsufficientCredits(msg);
      if (insuff) setInsufficient(insuff);
      else toast.error(msg);
      setPhase("input");
      refreshCredits();
    }
  };

  const reset = () => {
    setUrl("");
    setDna(null);
    setScraped(null);
    setAnalysisId(null);
    setViral(null);
    setPhase("input");
    navigate({ to: "/app", search: {} });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="min-h-full">
      {creditBalance !== null && (
        <div className="flex items-center justify-end border-b border-border px-4 py-2 lg:px-8">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            {creditBalance} credits
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        {phase === "input" && (
          <div className="flex flex-col items-center justify-center py-20">
            <h1 className="mb-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Paste any Instagram or Facebook URL
            </h1>
            <p className="mb-8 text-center text-muted-foreground">
              We'll deconstruct why it works and give you 5 viral angles for your niche.
            </p>
            <div className="relative w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
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
                  <Sparkles className="h-4 w-4" /> Analyze — {ACTION_COSTS.analysis} credits
                </Button>
              </div>
              {insufficient && (
                <div className="mt-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm animate-in fade-in">
                  <p className="font-semibold text-status-warning">
                    This analysis costs {insufficient.required} credits and you have {insufficient.available} — you're {insufficient.required - insufficient.available} short.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" disabled title="Payments aren't wired up yet">
                      Top up (coming soon)
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/settings", search: { section: "subscription" } })}>
                      View plans
                    </Button>
                  </div>
                </div>
              )}
              {postType && (
                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-500 dark:text-emerald-400 font-semibold animate-in fade-in slide-in-from-top-1 duration-300">
                  <span className="inline-block text-xl animate-bounce" style={{ animationDuration: '1.5s' }}>👍</span>
                  <span>Detected: {postType}</span>
                </div>
              )}
              {!postType && url && !isSupportedUrl(url) && (
                <div className="mt-2 text-sm text-status-error">Please enter a valid Instagram or Facebook URL</div>
              )}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">Reel · Carousel · Post · Video — any public Instagram or Facebook content</p>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="mx-auto max-w-xl py-20">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/10">
                  <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
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
              <p className="mt-3 text-xs text-muted-foreground">Reading the real media — usually 1–2 minutes</p>
            </div>
          </div>
        )}

        {phase === "results" && dna && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight gradient-text">Post Intelligence</h2>
                {savedBadge && (
                  <p className="text-xs text-muted-foreground">Saved · {savedBadge}</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
                <Plus className="h-4 w-4" /> New Analysis
              </Button>
            </div>

            {/* Post Intelligence Card */}
            <ChannelIntelHeader scraped={scraped} dna={dna} url={instagramUrl || url} />

            {/* What we captured — the honesty layer: the user must always
                know whether we hold the real media or just a thumbnail. */}
            {scraped?.scrapeCoverage && (
              <CoverageStrip coverage={scraped.scrapeCoverage} audio={scraped.audio} storedMedia={scraped.storedMedia} />
            )}

            <AnalysisEvidencePanel
              analysisId={analysisId}
              dna={dna}
              blueprint={observed.blueprint}
              transcript={observed.transcript}
              analysisConfidence={observed.analysisConfidence}
            />

            {fallbackMode && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Limited data mode — analysis based on URL pattern.
              </div>
            )}

            {/* Collapsible Full DNA */}
            <div className="rounded-xl border border-border bg-card">
              <button
                onClick={() => setDnaOpen((o) => !o)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-semibold">Full DNA Analysis</span>
                {dnaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {dnaOpen && (
                <div className="border-t border-border p-4 space-y-4 animate-in fade-in">
                  <div className="rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent-primary">
                      What This Post Is
                    </p>
                    <p className="text-sm leading-relaxed text-secondary-foreground">
                      {dna.contentSummary}
                    </p>
                  </div>
                  <Section title="Why This Works">
                    <ul className="space-y-1.5">
                      {(dna.whyItWorks ?? []).map((p: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-secondary-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" /> {p}
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <Section title="Hook Breakdown">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-md bg-accent-primary/10 px-2 py-0.5 text-xs font-medium text-accent-primary">
                        {dna.hookBreakdown?.type}
                      </span>
                      <span className="font-mono text-sm font-bold text-accent-primary">
                        {dna.hookBreakdown?.score}/10
                      </span>
                    </div>
                    <p className="text-sm text-secondary-foreground"><strong>What works:</strong> {dna.hookBreakdown?.whatWorks}</p>
                  </Section>
                  <Section title="Target Audience">
                    <p className="text-sm text-secondary-foreground"><strong>Who:</strong> {dna.targetAudience?.who}</p>
                    <p className="text-sm text-secondary-foreground"><strong>Desire:</strong> {dna.targetAudience?.desire}</p>
                    <p className="text-sm text-secondary-foreground"><strong>Trigger:</strong> {dna.targetAudience?.trigger}</p>
                  </Section>
                </div>
              )}
            </div>

            {/* THE MAIN OUTPUT — Intent → Preferences → 5 Viral Angles → Format */}
            {analysisProjects.length > 0 && (
              <div className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">
                      Your content from this post
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pick up where you left off — or scroll down to start a new angle.
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/projects" })}>
                    All projects →
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {analysisProjects.slice(0, 6).map((p: any) => {
                    const route =
                      p.format === "reel"
                        ? "/studio/reel"
                        : p.format === "carousel"
                          ? "/studio/carousel"
                          : p.format === "image"
                            ? "/studio/image"
                            : p.format === "voiceover"
                              ? "/studio/voiceover"
                              : "/app";
                    return (
                      <button
                        key={p.id}
                        onClick={() => navigate({ to: route as any, search: { projectId: p.id } as any })}
                        className="group flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition hover:border-strong hover:shadow-sm"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.latest_asset_url && (
                            <img src={p.latest_asset_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold">{p.title}</p>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {p.format} · {p.status?.replace("_", " ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {analysisId && <IntentFlow analysisId={analysisId} />}

            {viral && (
              <DecisionCard
                score={viral.score}
                band={viral.band}
                bandLabel={viral.bandLabel}
                recommendation={viral.recommendation}
                topFactor={viral.factors?.topFactor}
                hasClones={true}
                onSkip={reset}
              />
            )}
          </div>
        )}
      </div>

    </div>
  );
}

/** "What we captured" strip — slides, video, transcript, audio, storage. */
function CoverageStrip({ coverage, audio, storedMedia }: { coverage: any; audio?: any; storedMedia?: any[] }) {
  const storedCount = Array.isArray(storedMedia) ? storedMedia.length : 0;
  const slides =
    coverage.slidesExpected > 1
      ? `${coverage.slidesCaptured} of ${coverage.slidesExpected} slides`
      : null;
  const parts: string[] = [];
  if (slides) parts.push(slides);
  parts.push(coverage.videoCaptured ? "video: yes" : "video: no");
  parts.push(coverage.transcriptCaptured ? "transcript: yes" : "transcript: no");
  if (audio?.title) parts.push(`audio: ${audio.original ? "original" : audio.title}`);
  if (storedCount > 0) parts.push(`${storedCount} file${storedCount === 1 ? "" : "s"} saved`);

  const warn = coverage.thumbnailOnly || coverage.slidesCaptured < coverage.slidesExpected;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
        warn
          ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
          : "border-border bg-muted/30 text-muted-foreground"
      }`}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <p className="font-medium">
          {coverage.thumbnailOnly ? "Thumbnail only — the video couldn't be downloaded. " : "What we captured: "}
          {parts.join(" • ")}
        </p>
        {(coverage.notes ?? []).length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {coverage.notes.map((n: string, i: number) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}
