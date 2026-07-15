import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import {
  Search,
  Users,
  Hash,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Lightbulb,
  CalendarPlus,
  LayoutDashboard,
  TriangleAlert,
  TrendingUp,
  Radar,
  Layers3,
  CalendarClock,
  Rocket,
  BarChart3,
  BrainCircuit,
  Send,
  Download,
  Share2,
  Target,
  CheckCircle2,
  ArrowRight,
  CircleDot,
  Gauge,
  Palette,
  MessageSquare,
  Type,
  MousePointerClick,
  Eye,
  Bookmark,
  ShieldAlert,
  ShieldCheck,
  Compass,
  ChevronRight,
  Film,
  Images,
  Image as ImageIcon,
  StickyNote,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import {
  createResearchReport,
  listResearchReports,
  getResearchReport,
  toggleSaveResearch,
  deleteResearchReport,
  generateContentIdeas,
  saveIdeaToPlanner,
} from "@/lib/research.functions";
import { cn } from "@/lib/utils";
import { exportResearchPdf } from "@/lib/research-pdf";

const routeApi = getRouteApi("/_authenticated/research");

const NICHES = [
  "Fitness","Real Estate","Automotive","Marketing","Law","Finance",
  "Beauty","Travel","Cooking","Coaching","SaaS","E-commerce",
] as const;

type Report = {
  id: string;
  mode: string;
  subject: string;
  status: string;
  opportunity_score: number | null;
  is_saved?: boolean;
  error_message?: string | null;
  created_at: string | null;
};

// ─── Icon tile ─────────────────────────────────────────────────────
type Tone = "blue" | "green" | "amber" | "purple" | "rose" | "gray";
const TONE: Record<Tone, string> = {
  blue:   "bg-blue-500/10   text-blue-600   dark:text-blue-400   border-blue-500/20",
  green:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  amber:  "bg-amber-500/10  text-amber-600  dark:text-amber-400  border-amber-500/20",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  rose:   "bg-rose-500/10   text-rose-600   dark:text-rose-400   border-rose-500/20",
  gray:   "bg-muted         text-muted-foreground border-border",
};
function IconTile({
  icon: Icon, tone = "blue", size = 20,
}: { icon: React.ComponentType<{ className?: string }>; tone?: Tone; size?: 16 | 20 | 24 }) {
  const box = size === 24 ? "h-10 w-10" : size === 20 ? "h-9 w-9" : "h-7 w-7";
  const ico = size === 24 ? "h-5 w-5" : size === 20 ? "h-[18px] w-[18px]" : "h-[14px] w-[14px]";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-lg border", box, TONE[tone])}>
      <Icon className={ico} />
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────
export function ResearchPage() {
  const search = routeApi.useSearch();
  const navigate = useNavigate();

  const listFn = useServerFn(listResearchReports);
  const createFn = useServerFn(createResearchReport);
  const getFn = useServerFn(getResearchReport);
  const saveFn = useServerFn(toggleSaveResearch);
  const delFn = useServerFn(deleteResearchReport);
  const ideasFn = useServerFn(generateContentIdeas);

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<{ report: any; ideas: any[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ideasBusy, setIdeasBusy] = useState(false);

  const [tab, setTab] = useState<"niche" | "competitor" | "topic">("niche");
  const [niche, setNiche] = useState<string>("");
  const [competitor, setCompetitor] = useState("");
  const [topic, setTopic] = useState("");

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (search.reportId) openReport(search.reportId);
    else setDetail(null);
  }, [search.reportId]);

  async function refresh() {
    setLoadingList(true);
    try { const { reports } = await listFn(); setReports(reports as any); }
    catch (e) { toast.error((e as Error).message); }
    setLoadingList(false);
  }
  async function openReport(id: string) {
    setLoadingDetail(true);
    try { const res = await getFn({ data: { id } }); setDetail(res as any); }
    catch (e) { toast.error((e as Error).message); }
    setLoadingDetail(false);
  }
  async function submit() {
    const subject = tab === "niche" ? niche.trim() : tab === "competitor" ? competitor.trim() : topic.trim();
    if (!subject) { toast.error("Please enter a subject"); return; }
    setCreating(true);
    try {
      const { id } = await createFn({ data: { mode: tab, subject } });
      toast.success("Research report generated");
      await refresh();
      navigate({ to: "/research", search: { reportId: id } });
    } catch (e) { toast.error((e as Error).message); }
    setCreating(false);
  }
  async function runIdeas() {
    if (!detail?.report?.id) return;
    setIdeasBusy(true);
    try {
      const { ideas } = await ideasFn({ data: { id: detail.report.id } });
      setDetail({ ...detail, ideas });
      toast.success(`Generated ${ideas.length} content ideas`);
    } catch (e) { toast.error((e as Error).message); }
    setIdeasBusy(false);
  }

  if (search.reportId) {
    return (
      <ReportDetail
        detail={detail}
        loading={loadingDetail}
        onBack={() => navigate({ to: "/research", search: {} })}
        onNewResearch={() => navigate({ to: "/research", search: {} })}
        onSave={async () => {
          if (!detail?.report?.id) return;
          await saveFn({ data: { id: detail.report.id } });
          await refresh();
          await openReport(detail.report.id);
        }}
        onDelete={async () => {
          if (!detail?.report?.id) return;
          if (!confirm("Delete this research report?")) return;
          await delFn({ data: { id: detail.report.id } });
          toast.success("Deleted");
          navigate({ to: "/research", search: {} });
          refresh();
        }}
        ideasBusy={ideasBusy}
        onGenerateIdeas={runIdeas}
        onGenerateCampaign={() => navigate({ to: "/calendar" })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:py-12">
      <div className="mb-8 flex items-center gap-3">
        <IconTile icon={BrainCircuit} tone="purple" size={24} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Research</h1>
          <p className="text-sm text-muted-foreground">
            Uncover the audience, angles, and formats that actually convert.
          </p>
        </div>
      </div>

      <Card className="mb-10 p-5 lg:p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="niche" className="gap-2"><Hash className="h-4 w-4" />By Niche</TabsTrigger>
            <TabsTrigger value="competitor" className="gap-2"><Users className="h-4 w-4" />By Competitor</TabsTrigger>
            <TabsTrigger value="topic" className="gap-2"><Lightbulb className="h-4 w-4" />By Topic</TabsTrigger>
          </TabsList>

          <TabsContent value="niche">
            <Label className="mb-2 block">Pick or type a niche</Label>
            <div className="mb-3 flex flex-wrap gap-2">
              {NICHES.map((n) => (
                <button
                  key={n} type="button" onClick={() => setNiche(n)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition",
                    niche === n
                      ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                      : "border-border hover:border-border-default",
                  )}
                >{n}</button>
              ))}
            </div>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. Fitness Coaching" />
          </TabsContent>
          <TabsContent value="competitor">
            <Label className="mb-2 block">Instagram handle / creator / brand</Label>
            <Input value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="@alexhormozi or garyvee" />
          </TabsContent>
          <TabsContent value="topic">
            <Label className="mb-2 block">Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Lead generation, personal branding, weight loss…" />
          </TabsContent>
        </Tabs>

        <div className="mt-5 flex justify-end">
          <Button onClick={submit} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {creating ? "Analyzing… this can take up to a minute" : "Run Research"}
          </Button>
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent research</h2>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loadingList ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <IconTile icon={Compass} tone="purple" size={24} />
          <p className="mt-3 text-sm text-muted-foreground">No research yet. Run your first one above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate({ to: "/research", search: { reportId: r.id } })}
              className="group rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-accent-primary/40 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">{r.mode}</Badge>
                {r.opportunity_score != null && (
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-lg font-bold text-accent-primary">{r.opportunity_score}</span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </div>
                )}
              </div>
              <p className="mb-1 truncate text-base font-semibold">{r.subject}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {r.status === "ready"
                  ? <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Ready to explore</>
                  : r.status === "failed"
                  ? <><TriangleAlert className="h-3 w-3 text-rose-500" /> {r.error_message ?? "Failed"}</>
                  : <><Loader2 className="h-3 w-3 animate-spin" /> {r.status}</>}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REPORT DETAIL — the redesigned dashboard
// ═══════════════════════════════════════════════════════════════════

function ReportDetail({
  detail, loading, onBack, onNewResearch, onSave, onDelete, onGenerateIdeas, ideasBusy, onGenerateCampaign,
}: {
  detail: { report: any; ideas: any[] } | null;
  loading: boolean;
  onBack: () => void;
  onNewResearch: () => void;
  onSave: () => void;
  onDelete: () => void;
  onGenerateIdeas: () => void;
  ideasBusy: boolean;
  onGenerateCampaign: () => void;
}) {
  if (loading || !detail) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-24 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading report…
      </div>
    );
  }
  const { report, ideas } = detail;
  const dna = (report?.dna_report ?? {}) as any;
  const score = Number(report?.opportunity_score ?? 0);
  const perf = (dna?.performanceMetrics ?? {}) as any;
  const fmt  = (dna?.contentFormatDistribution ?? {}) as any;
  const limited = !!report?.limited_data;
  const postsAnalyzed = Number(report?.posts_analyzed ?? perf?.postsAnalyzed ?? 0);

  // ── Content Opportunity Engine local state ──────────────────────────
  const saveIdeaFn = useServerFn(saveIdeaToPlanner);
  const [savedIdeas, setSavedIdeas] = useState<Set<string>>(new Set());
  const [savingIdea, setSavingIdea] = useState<string | null>(null);
  const [ideaFormatFilter, setIdeaFormatFilter] = useState<string>("all");
  const [ideaSort, setIdeaSort] = useState<"confidence" | "virality" | "easy">("confidence");

  async function handleSaveIdea(idea: any) {
    if (savedIdeas.has(idea.id)) return;
    setSavingIdea(idea.id);
    try {
      const res = await saveIdeaFn({ data: { idea_id: idea.id } });
      setSavedIdeas((s) => new Set(s).add(idea.id));
      const when = (res as any)?.item?.scheduled_for ?? "planner";
      toast.success(`Saved to Planner · ${when}`, {
        action: { label: "Open Planner", onClick: () => window.location.assign("/calendar") },
      });
    } catch (e) {
      toast.error((e as Error).message || "Could not save to planner");
    }
    setSavingIdea(null);
  }

  const handleExportPdf = () => {
    try {
      exportResearchPdf(report, ideas);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Failed to export PDF");
    }
  };

  const pillars: any[] = Array.isArray(dna.contentPillars) ? dna.contentPillars : [];
  const pillarData = pillars.map((p) => ({
    name: String(p?.name ?? p?.pillarName ?? "").slice(0, 20),
    value: Number(p?.share ?? p?.percentage) || 0,
  }));

  const CHART_COLORS = ["#8134AF", "#DD2A7B", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899", "#10B981"];

  const growthOpp = arr(dna.growthOpportunities)[0];
  const topRisk = arr(dna.weaknesses)[0] ?? arr(dna.missedOpportunities)[0];
  const topPillar = pillars[0]?.name;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-32 pt-8 lg:pt-10">
      {/* ── Top nav row (mobile-optimized) ─────────────────────── */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Research
        </Button>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <Button size="sm" onClick={onNewResearch} className="shrink-0 gap-1">
            <Sparkles className="h-4 w-4" /> New Research
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="shrink-0 gap-1">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onSave} className="shrink-0 gap-1">
            <Star className={cn("h-4 w-4", report?.is_saved && "fill-current text-amber-500")} />
            {report?.is_saved ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="shrink-0 gap-1 text-status-error">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* ── HERO SUMMARY ────────────────────────────────────────── */}
      <Card className="mb-6 overflow-hidden border-border/60">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide">{report.mode}</Badge>
              <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </Badge>
              {topPillar && <Badge variant="outline" className="gap-1"><Target className="h-3 w-3" /> {topPillar}</Badge>}
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight lg:text-4xl">{report.subject}</h1>
            {dna.executiveSummary && (
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                {dna.executiveSummary}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={onGenerateCampaign} className="gap-2">
                <Rocket className="h-4 w-4" /> Generate 30-Day Campaign
              </Button>
              <Button variant="outline" onClick={onGenerateIdeas} disabled={ideasBusy} className="gap-2">
                {ideasBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {ideas.length > 0 ? "Regenerate Ideas" : "Generate Content Ideas"}
              </Button>
            </div>
          </div>

          <OpportunityGauge score={score} />
        </div>
      </Card>

      {/* ── LIMITED DATA BANNER ─────────────────────────────────── */}
      {limited && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Limited data mode</p>
            <p className="text-xs text-muted-foreground">
              {report?.limited_data_reason ??
                "Some post metrics are unavailable for this account. Content ideas and hook analysis are based on niche research and profile intelligence rather than post-level data."}
            </p>
          </div>
        </Card>
      )}

      {/* ── PERFORMANCE METRIC CARDS ──────────────────────────── */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          tone={engagementTone(perf?.engagementBenchmark)}
          icon={Gauge}
          label="Engagement rate"
          value={String(perf?.engagementRate ?? (limited ? "—" : "—"))}
          hint={perf?.engagementBenchmark ? capitalize(String(perf.engagementBenchmark)) : "Not available"}
        />
        <KpiCard
          tone="blue"
          icon={TrendingUp}
          label="Avg likes"
          value={numOrDash(perf?.avgLikesPerPost)}
          hint={postsAnalyzed ? `${postsAnalyzed} posts analyzed` : "No posts scraped"}
        />
        <KpiCard
          tone="purple"
          icon={MessageSquare}
          label="Avg comments"
          value={numOrDash(perf?.avgCommentsPerPost)}
          hint={perf?.avgViewsPerReel ? `${numOrDash(perf.avgViewsPerReel)} avg reel views` : undefined}
        />
        <KpiCard
          tone={Number(perf?.viralPostCount) > 0 ? "green" : "gray"}
          icon={Rocket}
          label="Viral posts"
          value={numOrDash(perf?.viralPostCount)}
          hint={perf?.viralThreshold ? "3× avg engagement threshold" : undefined}
          sub={postsAnalyzed ? `/ ${postsAnalyzed}` : undefined}
        />
      </div>

      {/* ── OPPORTUNITY + CADENCE strip ───────────────────────── */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard tone="green" icon={Target} label="Opportunity" value={`${score || "—"}`} sub="/ 100"
                 hint={score >= 70 ? "High" : score >= 40 ? "Moderate" : "Low"} />
        <KpiCard tone="rose"  icon={Radar}  label="Competition"
                 value={capitalize(String(dna?.competitivePosition?.competitionLevel ?? inferCompetition(score)))}
                 hint="Supply vs demand" />
        <KpiCard tone="blue"  icon={Users}  label="Audience"
                 value={firstWord(dna?.audienceProfile?.who) || "Defined"}
                 hint={shortText(dna?.audienceProfile?.who, 40) || "—"} />
        <KpiCard tone="amber" icon={CalendarClock} label="Cadence"
                 value={firstWord(dna?.postingFrequency) || "—"}
                 hint={shortText(dna?.postingFrequency, 34)} />
      </div>

      {/* ── CONTENT FORMAT DISTRIBUTION ───────────────────────── */}
      {(fmt?.imagePercent != null || fmt?.reelPercent != null || fmt?.carouselPercent != null) && !limited && (
        <Card className="mb-8 p-5">
          <SectionHead icon={Layers3} tone="purple" title="Content format mix" sub={fmt?.formatInsight || "Format distribution across scraped posts"} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <FormatBar label="Image"    value={Number(fmt?.imagePercent) || 0}    color="from-blue-500 to-blue-600" />
            <FormatBar label="Reel"     value={Number(fmt?.reelPercent) || 0}     color="from-violet-500 to-pink-500" />
            <FormatBar label="Carousel" value={Number(fmt?.carouselPercent) || 0} color="from-amber-500 to-orange-500" />
          </div>
        </Card>
      )}

      {/* ── AI INSIGHTS callouts ───────────────────────────────── */}
      {(growthOpp || topRisk) && (
        <div className="mb-8 grid gap-3 lg:grid-cols-2">
          {growthOpp && (
            <InsightCallout tone="green" icon={TrendingUp} title="Biggest opportunity">
              {String(growthOpp)}
            </InsightCallout>
          )}
          {topRisk && (
            <InsightCallout tone="amber" icon={ShieldAlert} title="Biggest risk">
              {String(topRisk)}
            </InsightCallout>
          )}
        </div>
      )}

      {/* ── CHARTS ─────────────────────────────────────────────── */}
      {pillarData.length > 0 && !limited && (
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <SectionHead icon={Layers3} tone="purple" title="Content pillar mix" sub="Share of voice by pillar" />
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer>
                <BarChart data={pillarData} layout="vertical" margin={{ left: 12, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip
                    cursor={{ fill: "rgba(129,52,175,0.06)" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                    {pillarData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <SectionHead icon={BarChart3} tone="blue" title="Distribution" sub="Content mix by topic weight" />
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Pie data={pillarData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {pillarData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ── COLLAPSIBLE RESEARCH SECTIONS ──────────────────────── */}
      <Accordion type="multiple" defaultValue={["exec"]} className="space-y-3">
        <SectionCard value="exec" icon={LayoutDashboard} tone="blue" title="Executive Summary"
          summary="Market snapshot, biggest opportunity, and recommended play.">
          <div className="grid gap-3 md:grid-cols-2">
            <BriefingBlock icon={Compass} tone="blue" title="Market snapshot">
              {dna.executiveSummary || "—"}
            </BriefingBlock>
            <BriefingBlock icon={TrendingUp} tone="green" title="Biggest opportunity">
              {growthOpp ?? "—"}
            </BriefingBlock>
            <BriefingBlock icon={ShieldAlert} tone="amber" title="Biggest risk">
              {topRisk ?? "—"}
            </BriefingBlock>
            <BriefingBlock icon={Rocket} tone="purple" title="Recommended play">
              {dna.storytellingStyle || dna.brandVoice || "—"}
            </BriefingBlock>
          </div>
        </SectionCard>

        <SectionCard value="audience" icon={Users} tone="blue" title="Audience Profile"
          summary={shortText(dna?.audienceProfile?.who, 100) || "Who they are and what they want."}>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniCard icon={Users} tone="blue" title="Who they are">{dna?.audienceProfile?.who || "—"}</MiniCard>
            <MiniCard icon={BrainCircuit} tone="purple" title="Psychographics">{dna?.audienceProfile?.psychographics || "—"}</MiniCard>
            <MiniCard icon={Target} tone="green" title="Desires">
              <IconList items={arr(dna?.audienceProfile?.desires)} icon={CheckCircle2} tone="green" />
            </MiniCard>
            <MiniCard icon={TriangleAlert} tone="rose" title="Pain points">
              <IconList items={arr(dna?.audienceProfile?.painPoints)} icon={CircleDot} tone="rose" />
            </MiniCard>
          </div>
        </SectionCard>

        <SectionCard value="pillars" icon={Layers3} tone="purple" title="Content Pillars"
          summary={`${pillars.length} strategic pillars driving this niche.`}>
          <div className="grid gap-3 md:grid-cols-2">
            {pillars.map((p, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconTile icon={Layers3} tone="purple" size={16} />
                    <h4 className="truncate text-sm font-semibold">{p.name}</h4>
                  </div>
                  {p.share != null && (
                    <Badge variant="outline" className="font-mono">{Math.round(Number(p.share))}%</Badge>
                  )}
                </div>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onGenerateIdeas}>
                    <Sparkles className="h-3 w-3" /> Ideas
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onGenerateCampaign}>
                    <KanbanIcon /> Campaign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard value="topics" icon={Sparkles} tone="green" title="Top Topics & Hooks"
          summary="What people are searching for and the hooks that stop the scroll.">
          <div className="grid gap-3 md:grid-cols-2">
            <MiniCard icon={Sparkles} tone="green" title="Top topics">
              <IconList
                items={arr(dna.topTopics).map((t: any) => `${t.topic} — ${t.why}`)}
                icon={ArrowRight} tone="green"
              />
            </MiniCard>
            <MiniCard icon={MousePointerClick} tone="purple" title="Common hooks">
              <ul className="space-y-2">
                {arr(dna.commonHooks).map((h: any, i: number) => (
                  <li key={i} className="rounded-md bg-muted/50 p-2 text-xs">
                    <div className="font-semibold">{h.pattern}</div>
                    <div className="italic text-muted-foreground">"{h.example}"</div>
                  </li>
                ))}
              </ul>
            </MiniCard>
          </div>
        </SectionCard>

        <SectionCard value="caption" icon={Type} tone="blue" title="Caption & Voice"
          summary="How to write and speak in this niche.">
          <div className="grid gap-3 md:grid-cols-2">
            <MiniCard icon={Type} tone="blue" title="Caption structure">
              <KV k="Length"  v={dna?.captionStructure?.typicalLength} />
              <KV k="Tone"    v={dna?.captionStructure?.tone} />
              <KV k="Opening" v={dna?.captionStructure?.openingStyle} />
              <KV k="CTA"     v={dna?.captionStructure?.ctaStyle} />
            </MiniCard>
            <MiniCard icon={MessageSquare} tone="purple" title="Brand voice">
              <p className="mb-2 text-sm text-muted-foreground">{dna.brandVoice || "—"}</p>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground"><b className="text-foreground">Storytelling:</b> {dna.storytellingStyle || "—"}</p>
            </MiniCard>
            <MiniCard icon={MousePointerClick} tone="green" title="CTA patterns">
              <IconList items={arr(dna.ctaPatterns)} icon={ArrowRight} tone="green" />
            </MiniCard>
            <MiniCard icon={Palette} tone="purple" title="Visual style">
              <KV k="Palette"     v={dna?.visualStyle?.palette} />
              <KV k="Composition" v={dna?.visualStyle?.composition} />
              <KV k="Overlay"     v={dna?.visualStyle?.textOverlay} />
              <KV k="Edit"        v={dna?.visualStyle?.editStyle} />
            </MiniCard>
          </div>
        </SectionCard>

        <SectionCard value="cadence" icon={CalendarClock} tone="amber" title="Posting Strategy"
          summary={shortText(`${dna.postingFrequency ?? ""} ${dna.postingTimes ? "• " + dna.postingTimes : ""}`, 100) || "Cadence, timing, and engagement patterns."}>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniCard icon={CalendarClock} tone="amber" title="Frequency">{dna.postingFrequency || "—"}</MiniCard>
            <MiniCard icon={CalendarClock} tone="amber" title="Best times">{dna.postingTimes || "—"}</MiniCard>
            <MiniCard icon={TrendingUp} tone="green" title="Engagement trends">{dna.engagementTrends || "—"}</MiniCard>
            <MiniCard icon={Eye} tone="blue" title="Thumbnail patterns">{dna.thumbnailPatterns || "—"}</MiniCard>
            <MiniCard icon={Share2} tone="purple" title="Most shared">{dna.mostShared || "—"}</MiniCard>
            <MiniCard icon={Bookmark} tone="purple" title="Most saved">{dna.mostSaved || "—"}</MiniCard>
          </div>
        </SectionCard>

        <SectionCard value="growth" icon={TrendingUp} tone="green" title="Growth Opportunities"
          summary={`${arr(dna.growthOpportunities).length} openings + ${arr(dna.competitiveAdvantages).length} advantages.`}>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniCard icon={TrendingUp} tone="green" title="Growth opportunities">
              <IconList items={arr(dna.growthOpportunities)} icon={ArrowRight} tone="green" />
            </MiniCard>
            <MiniCard icon={ShieldCheck} tone="blue" title="Competitive advantages">
              <IconList items={arr(dna.competitiveAdvantages)} icon={CheckCircle2} tone="blue" />
            </MiniCard>
            <MiniCard icon={TriangleAlert} tone="amber" title="Weaknesses to avoid">
              <IconList items={arr(dna.weaknesses)} icon={CircleDot} tone="amber" />
            </MiniCard>
            <MiniCard icon={Lightbulb} tone="purple" title="Missed opportunities">
              <IconList items={arr(dna.missedOpportunities)} icon={Sparkles} tone="purple" />
            </MiniCard>
          </div>
        </SectionCard>
      </Accordion>

      {/* ── CONTENT OPPORTUNITY ENGINE ─────────────────────────── */}
      <OpportunityEngine
        ideas={ideas}
        ideasBusy={ideasBusy}
        onGenerate={onGenerateIdeas}
        onSaveIdea={handleSaveIdea}
        savedIdeas={savedIdeas}
        savingIdea={savingIdea}
        formatFilter={ideaFormatFilter}
        setFormatFilter={setIdeaFormatFilter}
        sort={ideaSort}
        setSort={setIdeaSort}
      />

      {/* ── ACTION CENTER ──────────────────────────────────────── */}
      <div className="mt-12">
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={Rocket} tone="purple" size={20} />
          <div>
            <h2 className="text-xl font-bold">Action Center</h2>
            <p className="text-sm text-muted-foreground">Turn insight into shipped content.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard tone="purple" icon={Rocket}       title="Generate 30-Day Campaign" desc="AI-plan a full month grounded in this research." onClick={onGenerateCampaign} />
          <ActionCard tone="green"  icon={Sparkles}     title="Generate Ideas"           desc="50 ranked ideas ready for scripting."           onClick={onGenerateIdeas} />
          <ActionCard tone="blue"   icon={Send}         title="Publishing Schedule"      desc="Push to connected accounts."                    onClick={() => toast.info("Open Publishing Center from the sidebar")} />
          <ActionCard tone="amber"  icon={Download}     title="Export PDF Report"        desc="Agency-ready deliverable."                      onClick={handleExportPdf} />
        </div>
      </div>

      {/* ── FLOATING ACTION BAR ────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
          <Button size="sm" onClick={onGenerateCampaign} className="gap-1.5 rounded-full">
            <Rocket className="h-4 w-4" /> Campaign
          </Button>
          <Button size="sm" variant="ghost" onClick={onGenerateIdeas} disabled={ideasBusy} className="gap-1.5 rounded-full">
            <Sparkles className="h-4 w-4" /> Ideas
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExportPdf} className="gap-1.5 rounded-full">
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onSave} className="gap-1.5 rounded-full">
            <Star className={cn("h-4 w-4", report?.is_saved && "fill-current text-amber-500")} />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function OpportunityGauge({ score }: { score: number }) {
  const data = [{ name: "score", value: Math.max(0, Math.min(100, score)) }];
  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center self-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} fill="#8134AF" background={{ fill: "hsl(var(--muted))" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold text-accent-primary">{score || 0}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Opportunity</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, hint, sub, tone = "blue",
}: { icon: any; label: string; value: string; hint?: string; sub?: string; tone?: Tone }) {
  return (
    <Card className="group p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <IconTile icon={icon} tone={tone} size={16} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function InsightCallout({
  icon: Icon, title, children, tone,
}: { icon: any; title: string; children: React.ReactNode; tone: Tone }) {
  return (
    <Card className={cn("relative overflow-hidden p-5 pl-6", `before:absolute before:inset-y-0 before:left-0 before:w-1`, {
      "before:bg-emerald-500": tone === "green",
      "before:bg-amber-500":   tone === "amber",
      "before:bg-blue-500":    tone === "blue",
      "before:bg-violet-500":  tone === "purple",
      "before:bg-rose-500":    tone === "rose",
    })}>
      <div className="mb-2 flex items-center gap-2">
        <IconTile icon={Icon} tone={tone} size={16} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">AI Insight · {title}</span>
      </div>
      <p className="text-sm leading-relaxed">{children}</p>
    </Card>
  );
}

function SectionCard({
  value, icon, title, summary, tone, children,
}: { value: string; icon: any; title: string; summary?: string; tone: Tone; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-xl border border-border bg-card">
      <AccordionTrigger className="px-5 py-4 hover:no-underline">
        <div className="flex min-w-0 items-center gap-3 text-left">
          <IconTile icon={icon} tone={tone} size={20} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            {summary && <div className="truncate text-xs text-muted-foreground">{summary}</div>}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border/60 px-5 pb-5 pt-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function SectionHead({ icon, tone, title, sub }: { icon: any; tone: Tone; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={icon} tone={tone} size={16} />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function BriefingBlock({
  icon, title, tone, children,
}: { icon: any; title: string; tone: Tone; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <IconTile icon={icon} tone={tone} size={16} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function MiniCard({
  icon, title, tone, children,
}: { icon: any; title: string; tone: Tone; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <IconTile icon={icon} tone={tone} size={16} />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function IconList({ items, icon: Icon, tone }: { items: unknown[]; icon: any; tone: Tone }) {
  const arr2 = Array.isArray(items) ? items : [];
  if (arr2.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="space-y-1.5">
      {arr2.map((x, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={cn("mt-0.5 shrink-0 rounded-md p-0.5", TONE[tone])}>
            <Icon className="h-3 w-3" />
          </span>
          <span className="leading-relaxed">{String(x)}</span>
        </li>
      ))}
    </ul>
  );
}

function KV({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="mb-1.5 flex items-baseline gap-2 text-sm">
      <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className="min-w-0">{v}</span>
    </div>
  );
}

// ─── Content Opportunity Engine ───────────────────────────────────

const FORMAT_META: Record<string, { icon: any; tone: Tone; label: string }> = {
  Reel:     { icon: Film,       tone: "purple", label: "Reel" },
  Carousel: { icon: Images,     tone: "blue",   label: "Carousel" },
  Post:     { icon: ImageIcon,  tone: "green",  label: "Post" },
  Story:    { icon: StickyNote, tone: "amber",  label: "Story" },
};
function formatMeta(f?: string) {
  const key = (f ?? "Post").trim();
  return FORMAT_META[key] ?? FORMAT_META.Post;
}

function ScoreBar({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const barTone =
    tone === "green"  ? "bg-emerald-500" :
    tone === "amber"  ? "bg-amber-500"   :
    tone === "blue"   ? "bg-blue-500"    :
    tone === "purple" ? "bg-violet-500"  :
    tone === "rose"   ? "bg-rose-500"    : "bg-muted-foreground";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold tabular-nums">{pct}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const data = [{ v: pct }];
  const color = pct >= 75 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative h-11 w-11 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="v" cornerRadius={8} fill={color} background={{ fill: "hsl(var(--muted))" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[11px] font-bold tabular-nums">{pct}</span>
      </div>
    </div>
  );
}

function IdeaCard({
  idea, saved, saving, onSave,
}: { idea: any; saved: boolean; saving: boolean; onSave: () => void }) {
  const meta = formatMeta(idea.format);
  const FIcon = meta.icon;
  return (
    <Card className="group flex flex-col overflow-hidden border-border/60 p-0 transition hover:-translate-y-0.5 hover:border-accent-primary/50 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider", TONE[meta.tone])}>
          <FIcon className="h-3 w-3" />
          {meta.label}
        </div>
        <ConfidenceRing value={idea.confidence_score} />
      </div>

      <div className="flex-1 px-5 pt-3">
        <h3 className="mb-2 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
          {idea.title}
        </h3>
        {idea.hook && (
          <blockquote className="mb-3 border-l-2 border-accent-primary/40 pl-3 text-[13px] italic leading-relaxed text-foreground/80 line-clamp-2">
            {idea.hook}
          </blockquote>
        )}
        {idea.description && (
          <p className="mb-4 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {idea.description}
          </p>
        )}
      </div>

      <div className="space-y-2.5 border-t border-border/60 bg-muted/20 px-5 py-4">
        <ScoreBar label="Virality"   value={idea.virality_score}          tone="green" />
        <ScoreBar label="Audience"   value={idea.audience_interest_score} tone="blue" />
        <ScoreBar label="Difficulty" value={idea.difficulty_score}        tone="amber" />
      </div>

      <div className="px-5 pb-4">
        <Button
          size="sm"
          variant={saved ? "secondary" : "default"}
          className="w-full gap-1.5"
          onClick={onSave}
          disabled={saving || saved}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <CalendarPlus className="h-3.5 w-3.5" />
          )}
          {saved ? "Saved to Planner" : saving ? "Saving…" : "Save to Planner"}
        </Button>
      </div>
    </Card>
  );
}

function OpportunityEngine({
  ideas, ideasBusy, onGenerate, onSaveIdea, savedIdeas, savingIdea,
  formatFilter, setFormatFilter, sort, setSort,
}: {
  ideas: any[];
  ideasBusy: boolean;
  onGenerate: () => void;
  onSaveIdea: (idea: any) => void;
  savedIdeas: Set<string>;
  savingIdea: string | null;
  formatFilter: string;
  setFormatFilter: (v: string) => void;
  sort: "confidence" | "virality" | "easy";
  setSort: (v: "confidence" | "virality" | "easy") => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ideas.length };
    for (const i of ideas) c[i.format] = (c[i.format] ?? 0) + 1;
    return c;
  }, [ideas]);

  const filtered = useMemo(() => {
    let out = formatFilter === "all" ? ideas : ideas.filter((i) => i.format === formatFilter);
    out = [...out].sort((a, b) => {
      if (sort === "virality") return (b.virality_score || 0) - (a.virality_score || 0);
      if (sort === "easy") return (a.difficulty_score || 0) - (b.difficulty_score || 0);
      return (b.confidence_score || 0) - (a.confidence_score || 0);
    });
    return out;
  }, [ideas, formatFilter, sort]);

  const avgViral = ideas.length ? Math.round(ideas.reduce((s, i) => s + (i.virality_score || 0), 0) / ideas.length) : 0;
  const avgConf  = ideas.length ? Math.round(ideas.reduce((s, i) => s + (i.confidence_score || 0), 0) / ideas.length) : 0;
  const highCount = ideas.filter((i) => (i.confidence_score || 0) >= 80).length;

  const filterChips: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Reel", label: "Reels" },
    { key: "Carousel", label: "Carousels" },
    { key: "Post", label: "Posts" },
    { key: "Story", label: "Stories" },
  ];

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <IconTile icon={Sparkles} tone="green" size={24} />
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight lg:text-2xl">Content Opportunity Engine</h2>
            <p className="text-sm text-muted-foreground">
              AI-ranked ideas grounded in this DNA report — save straight to your Planner.
            </p>
          </div>
        </div>
        <Button onClick={onGenerate} disabled={ideasBusy} className="shrink-0 gap-2">
          {ideasBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {ideas.length > 0 ? "Regenerate" : "Generate 50 Ideas"}
        </Button>
      </div>

      {ideas.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <IconTile icon={Lightbulb} tone="amber" size={24} />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Run the opportunity engine to get 50 ranked, scored content ideas you can drop straight into a campaign.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat icon={Lightbulb}    tone="green"  label="Ideas"          value={String(ideas.length)} />
            <MiniStat icon={TrendingUp}   tone="purple" label="Avg virality"   value={`${avgViral}`} suffix="/100" />
            <MiniStat icon={Gauge}        tone="blue"   label="Avg confidence" value={`${avgConf}`} suffix="/100" />
            <MiniStat icon={CheckCircle2} tone="amber"  label="High-conf"      value={String(highCount)} suffix=" · 80+" />
          </div>

          {/* Controls */}
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex items-center gap-1.5">
                {filterChips.map((c) => {
                  const active = formatFilter === c.key;
                  const n = counts[c.key] ?? 0;
                  if (c.key !== "all" && n === 0) return null;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setFormatFilter(c.key)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
                        active
                          ? "border-accent-primary/50 bg-accent-primary/10 text-accent-primary"
                          : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.label} <span className="ml-1 font-mono opacity-70">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Sort:</span>
              {(["confidence", "virality", "easy"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "rounded-md px-2 py-1 font-medium transition",
                    sort === s ? "bg-muted text-foreground" : "hover:text-foreground",
                  )}
                >
                  {s === "confidence" ? "Confidence" : s === "virality" ? "Virality" : "Easiest"}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((idea: any) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                saved={savedIdeas.has(idea.id)}
                saving={savingIdea === idea.id}
                onSave={() => onSaveIdea(idea)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, suffix, tone,
}: { icon: any; label: string; value: string; suffix?: string; tone: Tone }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <IconTile icon={Icon} tone={tone} size={16} />
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold tabular-nums">{value}</span>
          {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
        </div>
      </div>
    </Card>
  );
}

function ActionCard({
  icon: Icon, title, desc, onClick, tone,
}: { icon: any; title: string; desc: string; onClick: () => void; tone: Tone }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-accent-primary/40 hover:shadow-md"
    >
      <IconTile icon={Icon} tone={tone} size={24} />
      <div>
        <div className="mb-1 flex items-center gap-1 text-sm font-semibold">
          {title}
          <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function KanbanIcon() {
  return <Layers3 className="h-3 w-3" />;
}

// ─── utils ────────────────────────────────────────────────────────
function arr(v: unknown): any[] { return Array.isArray(v) ? v : []; }
function firstWord(s?: string) { return (s ?? "").trim().split(/[\s,.]/)[0] || ""; }
function shortText(s?: string, n = 60) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function inferCompetition(score: number) {
  if (!score) return "—";
  if (score >= 75) return "Low";
  if (score >= 50) return "Medium";
  return "High";
}
