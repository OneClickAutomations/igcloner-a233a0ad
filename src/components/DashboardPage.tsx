import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { proxiedImg } from "@/lib/img-proxy";
import mascotWelcome from "@/assets/mascot-welcome.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Sparkles,
  Trash2,
  ExternalLink,
  Microscope,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Search,
  Copy,
  FolderOpen,
  ChevronRight,
  CircleHelp,
  BarChart3,
} from "lucide-react";
import { getResearchDashboard } from "@/lib/research.functions";
import { ensureAnalysisThumbnails } from "@/lib/analysis-thumbs.functions";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  activeDays,
  countPreviousMonth,
  countThisMonth,
  dailySeries,
  monthDelta,
  type MonthDelta,
} from "@/lib/dashboard-metrics";

// Deterministic premium gradient per account handle so the fallback tile
// feels branded and consistent, not random.

function AnalysisThumb({
  src,
  postType,
  account,
}: {
  src: string | null;
  postType: string | null;
  account: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (account?.trim()?.[0] ?? "•").toUpperCase();

  if (!src || failed) {
    return (
      <div className="dashboard-thumb-fallback relative flex h-full w-full items-center justify-center">
        <span className="relative z-10 font-serif text-5xl font-semibold text-foreground">
          {initial}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`@${account ?? ""} post`}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

interface AnalysisItem {
  id: string;
  instagram_url: string;
  post_type: string | null;
  source_account: string | null;
  performance_score: number | null;
  created_at: string | null;
  scraped_data: any;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreColor(score: number) {
  if (score >= 80) return "text-status-success";
  if (score >= 60) return "text-status-warning";
  return "text-status-error";
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={scoreColor(pct)}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${scoreColor(pct)}`}
      >
        {pct}
      </span>
    </div>
  );
}

export function DashboardPage() {
  return <DashboardPageInner />;
}

type Tone = { t1: string; t2: string };
const toneStyle = (t: Tone) => ({ "--t1": `var(--tone-${t.t1})`, "--t2": `var(--tone-${t.t2})` }) as React.CSSProperties;

// Real 14-day daily-count sparkline. Returns null for an all-zero series so
// a new account doesn't get a flat line implying data that isn't there.
function Sparkline({ data, id }: { data: number[]; id: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) return null;
  const max = Math.max(...data);
  const w = 120;
  const h = 32;
  const coords = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / max) * (h - 4) - 2]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const gid = `spark-${id}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--t1)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--t1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--t1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Delta pill: up = tone colour + up arrow, down = red + down arrow,
// flat = neutral, new = "New" badge when the previous month was zero.
function DeltaPill({ delta }: { delta: MonthDelta }) {
  if (delta.kind === "none") return null;
  const style: React.CSSProperties =
    delta.kind === "down"
      ? { background: "color-mix(in oklab, var(--tone-rose) 14%, transparent)", color: "var(--tone-rose)" }
      : delta.kind === "flat"
        ? { background: "color-mix(in oklab, var(--tone-slate) 14%, transparent)", color: "var(--tone-slate)" }
        : { background: "color-mix(in oklab, var(--t1) 14%, transparent)", color: "var(--t1)" };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={style}
    >
      {delta.kind === "up" && <TrendingUp className="h-3 w-3" />}
      {delta.kind === "down" && <TrendingDown className="h-3 w-3" />}
      {delta.kind === "flat" && <Minus className="h-3 w-3" />}
      {delta.label}
    </span>
  );
}

// ── KPI tile ───────────────────────────────────────────────
function StatTile({
  icon,
  label,
  value,
  loading,
  tone,
  delta,
  series,
  id,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  tone: Tone;
  delta: MonthDelta;
  series: number[];
  id: string;
}) {
  return (
    <div className="stat-card flex flex-col p-5 sm:p-6" style={toneStyle(tone)}>
      <div className="flex items-center gap-2">
        <span className="tone-icon flex h-9 w-9 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <span className="min-w-0 flex-1 text-xs font-semibold uppercase leading-relaxed tracking-wider text-muted-foreground">{label}</span>
        <span className="dashboard-help relative shrink-0" tabIndex={0} aria-label={`About ${label}`}>
          <CircleHelp className="h-4 w-4 text-muted-foreground" />
          <span role="tooltip">{id === "analyses" ? "Completed post analyses. Open one below to decide what to recreate." : id === "clones" ? "Clones you have generated. Compare this with analyses to see how often research becomes content." : id === "saved" ? "Projects you have saved. Open Projects to continue your work." : "Days with a completed analysis in the last 30 days. Use this to track a consistent research habit."}</span>
        </span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-muted" />
      ) : (
        <p className="mt-2 text-3xl font-semibold leading-none tabular-nums sm:mt-3 sm:text-4xl">
          {value.toLocaleString()}
        </p>
      )}
      {(delta.kind !== "none" || series.some((v) => v > 0)) ? (
      <div className="mt-3 flex items-center gap-3">
        <DeltaPill delta={delta} />
        <div className="min-w-0 flex-1">
          <Sparkline data={series} id={id} />
        </div>
      </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">All time</p>
      )}
    </div>
  );
}

// Format-specific color for trending items.
function formatTone(sub?: string): string {
  const s = (sub ?? "").toLowerCase();
  if (s.includes("reel") || s.includes("video")) return "var(--tone-blue)";
  if (s.includes("carousel")) return "var(--tone-amber)";
  if (s.includes("story")) return "var(--tone-teal)";
  return "var(--tone-pink)";
}

// ── Research intelligence rail widget ──────────────────────
function ResearchWidget({
  icon,
  title,
  empty,
  items,
  tone,
  accentItems,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  items: Array<{ key: string; label: string; sub?: string; onClick: () => void }>;
  tone: Tone;
  accentItems?: boolean;
}) {
  return (
    <div className="dash-card p-5" style={toneStyle(tone)}>
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <span className="tone-icon flex h-8 w-8 items-center justify-center rounded-lg">{icon}</span>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">{empty}</p>
      ) : (
        <ul className="-mx-1 space-y-1.5">
          {items.slice(0, 5).map((it) => {
            const c = accentItems ? formatTone(it.sub) : "var(--t1)";
            return (
              <li key={it.key}>
                <Button
                  variant="ghost"
                  onClick={it.onClick}
                  className="group relative flex w-full items-center gap-2.5 overflow-hidden h-auto rounded-lg py-3 pl-3.5 pr-2 text-left transition-colors hover:bg-muted/70"
                >
                  {accentItems && (
                    <span
                      className="absolute inset-y-1 left-0 w-[3px] rounded-full"
                      style={{ background: `linear-gradient(180deg, ${c}, var(--t2))` }}
                    />
                  )}
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c,  }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.label}</span>
                    {it.sub && (
                      <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
                    )}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const TYPE_BADGE: Record<string, string> = {
  reel: "var(--tone-blue)",
  video: "var(--tone-blue)",
  carousel: "var(--tone-amber)",
  sidecar: "var(--tone-amber)",
};

function DashboardPageInner() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string>("");
  const [stats, setStats] = useState({ posts: 0, clones: 0, saved: 0 });
  // created_at dates per metric, used for real deltas and sparklines.
  const [dates, setDates] = useState<{ analyses: string[]; clones: string[]; saved: string[] }>({
    analyses: [],
    clones: [],
    saved: [],
  });
  const dashFn = useServerFn(getResearchDashboard);
  const cacheThumbsFn = useServerFn(ensureAnalysisThumbnails);
  const [cachedThumbs, setCachedThumbs] = useState<Record<string, string | null>>({});
  const [research, setResearch] = useState<{
    recent: any[];
    saved: any[];
    watchlist: any[];
    trending: any[];
  }>({ recent: [], saved: [], watchlist: [], trending: [] });

  useEffect(() => {
    loadAnalyses();
    dashFn().then(setResearch).catch(() => {});
  }, []);

  async function loadAnalyses() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    const meta: any = userData.user.user_metadata ?? {};
    const rawName: string =
      meta.full_name || meta.name || userData.user.email?.split("@")[0] || "";
    if (rawName) setFirstName(rawName.split(" ")[0].replace(/^\w/, (c) => c.toUpperCase()));

    const { data, error } = await supabase
      .from("analyses")
      .select("id, instagram_url, post_type, source_account, performance_score, created_at, scraped_data, analysis_status")
      .eq("user_id", uid)
      // Failed runs are hidden; in-progress runs show with an "Analyzing" chip.
      .neq("analysis_status", "failed")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load analyses");
      setLoading(false);
      return;
    }

    setAnalyses(data || []);

    // Cache IG thumbnails to our own bucket so they don't disappear when
    // Instagram's signed URLs expire. Fire-and-forget; UI still renders.
    const ids = (data ?? []).slice(0, 12).map((a: any) => a.id);
    if (ids.length > 0) {
      cacheThumbsFn({ data: { ids } })
        .then((res: any) => setCachedThumbs((prev) => ({ ...prev, ...(res?.thumbnails ?? {}) })))
        .catch(() => {});
    }

    // Select created_at (not head-only counts) so deltas and sparklines are real.
    const [clonesRes, savedRes] = await Promise.all([
      supabase.from("clones").select("created_at").eq("user_id", uid),
      supabase.from("saved_projects").select("created_at").eq("user_id", uid),
    ]);

    const readyRows = (data ?? []).filter((a: any) => a.analysis_status === "ready");
    const analysisDates = readyRows.map((a) => a.created_at).filter(Boolean) as string[];
    const cloneDates = (clonesRes.data ?? []).map((c: any) => c.created_at).filter(Boolean) as string[];
    const savedDates = (savedRes.data ?? []).map((s: any) => s.created_at).filter(Boolean) as string[];
    setDates({ analyses: analysisDates, clones: cloneDates, saved: savedDates });

    setStats({
      posts: readyRows.length,
      clones: cloneDates.length,
      saved: savedDates.length,
    });
    setLoading(false);
  }

  async function deleteAnalysis(id: string) {
    if (!confirm("Delete this analysis and its clones?")) return;
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted");
      loadAnalyses();
    }
  }

  // ── Real KPI metrics ─────────────────────────────────────
  const now = new Date();
  const analysesDelta = monthDelta(countThisMonth(dates.analyses, now), countPreviousMonth(dates.analyses, now));
  const clonesDelta = monthDelta(countThisMonth(dates.clones, now), countPreviousMonth(dates.clones, now));
  const savedDelta = monthDelta(countThisMonth(dates.saved, now), countPreviousMonth(dates.saved, now));
  // Tile 4: "Active Days" — distinct days with ≥1 analysis in the last 30,
  // compared against the 30 days before that (a like-for-like window).
  const activeNow = activeDays(dates.analyses, 30, now);
  const priorStart = new Date(now);
  priorStart.setDate(priorStart.getDate() - 60);
  const activePrev = activeDays(
    dates.analyses.filter((iso) => new Date(iso) < new Date(now.getTime() - 30 * 86400000)),
    30,
    priorStart,
  );
  const activeDelta = monthDelta(activeNow, activePrev);

  const spark = {
    analyses: dailySeries(dates.analyses, 14, now),
    clones: dailySeries(dates.clones, 14, now),
    saved: dailySeries(dates.saved, 14, now),
  };

  // Chart: analyses per day, last 30 days, zero days included.
  const chartSeries = dailySeries(dates.analyses, 30, now);
  const chartData = chartSeries.map((count, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    return { day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count };
  });

  return (
    <div className="dashboard-screen min-h-full">
      {/* Ambient colour clouds behind the whole dashboard (landing-page blob treatment) */}

      {/* Ambient gradient wash behind the header */}
      <div className="relative">


        <div className="relative mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">
          {/* ── Page header: CTA lives here, outside the banner ── */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3"><span className="dashboard-heading-icon"><BarChart3 className="h-6 w-6" /></span><h2 className="text-2xl font-bold">Dashboard</h2></div>
            <Button
              onClick={() => navigate({ to: "/app" })}
              className="gap-2 rounded-lg border-0 text-primary-foreground hover:opacity-95"
            >
              <Sparkles className="h-4 w-4" /> Analyze a Post
            </Button>
          </div>

          {/* ── Welcome banner: filled panel, character full height ── */}
          <header className="welcome-banner flex min-h-[176px] items-center overflow-hidden py-5 pl-5 pr-[112px] sm:px-8 sm:pr-[170px] lg:mt-6 lg:h-[176px] lg:overflow-visible lg:py-0 lg:pr-[260px]">
            <div className="relative z-10 min-w-0 flex-1">
              <h1 className="text-2xl leading-tight sm:text-3xl font-semibold">
                Welcome back{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--wb-fg-soft)" }}>
                Here's what's happening across your content studio.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium" style={{ background: "var(--wb-chip)", borderColor: "var(--wb-chip-border)" }}>
                  <Search className="h-3.5 w-3.5" />
                  <span className="font-mono font-bold tabular-nums">{loading ? "—" : stats.posts.toLocaleString()}</span>
                  posts analyzed
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium" style={{ background: "var(--wb-chip)", borderColor: "var(--wb-chip-border)" }}>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="font-mono font-bold tabular-nums">{loading ? "—" : stats.clones.toLocaleString()}</span>
                  clones generated
                </span>
              </div>
            </div>
            {/* Mascot: bottom-aligned, taller than the panel so it stands in it */}
            <div className="pointer-events-none absolute -bottom-3 -right-4 h-[130px] sm:right-4 sm:bottom-0 sm:h-[170px] lg:right-6 lg:h-[200px] xl:right-10">
              <img src={mascotWelcome} alt="" className="h-full w-auto object-contain" />
            </div>
          </header>

          {/* ── KPI band ────────────────────────────────────── */}
          <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              icon={<Search className="h-5 w-5" />}
              tone={{ t1: "purple", t2: "indigo" }} delta={analysesDelta} series={spark.analyses} id="analyses"
              label="Posts Analyzed"
              value={stats.posts}
              loading={loading}
            />
            <StatTile
              icon={<Copy className="h-5 w-5" />}
              tone={{ t1: "pink", t2: "rose" }} delta={clonesDelta} series={spark.clones} id="clones"
              label="Clones Generated"
              value={stats.clones}
              loading={loading}
            />
            <StatTile
              icon={<FolderOpen className="h-5 w-5" />}
              tone={{ t1: "purple", t2: "violet" }} delta={savedDelta} series={spark.saved} id="saved"
              label="Saved Projects"
              value={stats.saved}
              loading={loading}
            />
            <StatTile
              icon={<Flame className="h-5 w-5" />}
              tone={{ t1: "amber", t2: "orange" }} delta={activeDelta} series={spark.analyses} id="active"
              label="Active Days · 30d"
              value={activeNow}
              loading={loading}
            />
          </section>

          {/* ── Main two-column area ────────────────────────── */}
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-3 [&>*]:min-w-0">
            {/* Recent analyses */}
            <div className="space-y-6 lg:col-span-2">
            {/* ── Analyses chart (last 30 days) ───────────────── */}
            <section className="dash-card p-5" style={toneStyle({ t1: "purple", t2: "pink" })}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3"><span className="tone-icon flex h-9 w-9 items-center justify-center rounded-lg"><BarChart3 className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">Analysis activity</h2><p className="text-sm text-muted-foreground">Your last 30 days</p></div></div>
                {!loading && stats.posts > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {chartSeries.reduce((a, b) => a + b, 0)} in window
                  </span>
                )}
              </div>
              {loading ? (
                <div className="h-48 animate-pulse rounded-xl bg-muted" />
              ) : stats.posts === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                  <TrendingUp className="mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">No analyses yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your daily analysis activity will appear here once you analyze your first post.
                  </p>
                </div>
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="analysesFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--tone-purple)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--tone-pink)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={40}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        cursor={{ stroke: "var(--tone-purple)", strokeOpacity: 0.3 }}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          fontSize: 12,
                          color: "var(--foreground)",
                        }}
                        labelStyle={{ color: "var(--muted-foreground)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Analyses"
                        stroke="var(--tone-purple)"
                        strokeWidth={2.5}
                        fill="url(#analysesFill)"
                        dot={false}
                        activeDot={{ r: 4, fill: "var(--tone-pink)", stroke: "var(--card)", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
              <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Recent <span className="gradient-text-tone">Analyses</span></h2>
                {analyses.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/projects" })}
                    className="inline-flex items-center gap-1 text-sm font-medium text-accent-primary"
                  >
                    View projects <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="mb-3 aspect-[4/3] rounded-lg bg-muted" />
                      <div className="mb-2 h-4 w-24 rounded bg-muted" />
                      <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : analyses.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-accent shadow-ig">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-base font-bold">No analyses yet</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Paste an Instagram URL to break down its Content DNA and generate your first
                    clones.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/app" })}
                    className="mt-5 gap-2 border-0 text-primary-foreground"
                  >
                    <Sparkles className="h-4 w-4" /> Analyze Now
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {analyses.slice(0, 6).map((a) => {
                    const raw = a.scraped_data?.displayUrl || a.scraped_data?.thumbnailUrl;
                    const t = cachedThumbs[a.id] ?? proxiedImg(raw);
                    return (
                      <div
                        key={a.id}
                        style={toneStyle({ t1: "purple", t2: "pink" })}
                        className="dash-card group flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-ig-hover"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                          <AnalysisThumb src={t} postType={a.post_type} account={a.source_account} />
                          <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-ig" style={{ background: TYPE_BADGE[(a.post_type || "post").toLowerCase()] ?? "var(--tone-pink)" }}>
                            {a.post_type || "Post"}
                          </span>
                          <div className="absolute right-2 top-2">
                            {(a as any).analysis_status === "processing" ? (
                              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-primary shadow-ig backdrop-blur">Analyzing…</span>
                            ) : (
                              <div className="rounded-full bg-background/60 p-0.5 shadow-ig backdrop-blur">
                                <ScoreRing score={a.performance_score ?? 0} />
                              </div>
                            )}
                          </div>
                          <div className="dashboard-account absolute inset-x-2 bottom-2 rounded-lg border border-border px-3 py-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              @{a.source_account || "unknown"}
                            </p>
                            <p className="text-xs text-foreground/75">{timeAgo(a.created_at)}</p>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="mt-auto flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => navigate({ to: "/app", search: { analysisId: a.id } })}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-status-error hover:bg-status-error/10 hover:text-status-error"
                              onClick={() => deleteAnalysis(a.id)}
                              aria-label="Delete analysis"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            {/* Research intelligence rail */}
            <aside className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Research intelligence</h2>
              </div>
              <ResearchWidget
                icon={<TrendingUp className="h-4 w-4" />}
                title="Trending Opportunities"
                tone={{ t1: "purple", t2: "pink" }}
                accentItems
                empty="Run research to surface high-signal content ideas."
                items={research.trending.map((i) => ({
                  key: i.id,
                  label: i.title,
                  sub: `${i.format} · ${i.confidence_score}% confidence`,
                  onClick: () =>
                    navigate({ to: "/research", search: { reportId: i.research_report_id } }),
                }))}
              />
              <ResearchWidget
                icon={<Users className="h-4 w-4" />}
                title="Competitor Watchlist"
                tone={{ t1: "purple", t2: "violet" }}
                empty="Research a competitor to add them here."
                items={research.watchlist.map((c) => ({
                  key: c.id,
                  label: `@${c.handle}`,
                  sub: c.display_name ?? "",
                  onClick: () =>
                    c.last_report_id
                      ? navigate({ to: "/research", search: { reportId: c.last_report_id } })
                      : navigate({ to: "/research" }),
                }))}
              />
              <ResearchWidget
                icon={<Microscope className="h-4 w-4" />}
                title="Recent Research"
                tone={{ t1: "green", t2: "green" }}
                empty="No research reports yet."
                items={research.recent.map((r) => ({
                  key: r.id,
                  label: r.subject,
                  sub: `${r.mode} · ${r.status}`,
                  onClick: () => navigate({ to: "/research", search: { reportId: r.id } }),
                }))}
              />
              <ResearchWidget
                icon={<Star className="h-4 w-4" />}
                title="Saved Research"
                tone={{ t1: "amber", t2: "orange" }}
                empty="Star a report to pin it here."
                items={research.saved.map((r) => ({
                  key: r.id,
                  label: r.subject,
                  sub: `${r.mode} · score ${r.opportunity_score ?? "—"}`,
                  onClick: () => navigate({ to: "/research", search: { reportId: r.id } }),
                }))}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
