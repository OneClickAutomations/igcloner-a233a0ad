import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { proxiedImg } from "@/lib/img-proxy";
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
  Search,
  Copy,
  Bookmark,
  Calendar,
  Send,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { getResearchDashboard } from "@/lib/research.functions";

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
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center gradient-card text-4xl">
        {postType === "Reel" ? "🎬" : postType === "Carousel" ? "🎴" : "📸"}
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
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
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
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono ${scoreColor(pct)}`}
      >
        {pct}
      </span>
    </div>
  );
}

export function DashboardPage() {
  return <DashboardPageInner />;
}

// ── KPI tile ───────────────────────────────────────────────
function StatTile({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-ig transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ig-hover sm:p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent-primary/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
          {icon}
        </span>
      </div>
      {loading ? (
        <div className="mt-4 h-8 w-16 animate-pulse rounded-md bg-muted" />
      ) : (
        <p className="mt-3 font-mono text-3xl font-extrabold tracking-tight tabular-nums">
          {value.toLocaleString()}
        </p>
      )}
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

// ── Quick action card ──────────────────────────────────────
function ActionCard({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-ig transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary/30 hover:shadow-ig-hover"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${
          accent
            ? "gradient-accent text-white shadow-ig"
            : "bg-accent-primary/10 text-accent-primary"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}

// ── Research intelligence rail widget ──────────────────────
function ResearchWidget({
  icon,
  title,
  empty,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  items: Array<{ key: string; label: string; sub?: string; onClick: () => void }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-ig">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-secondary/10 text-accent-secondary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">{empty}</p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {items.slice(0, 5).map((it) => (
            <li key={it.key}>
              <button
                onClick={it.onClick}
                className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.label}</span>
                  {it.sub && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {it.sub}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardPageInner() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string>("");
  const [stats, setStats] = useState({ posts: 0, clones: 0, saved: 0, monthUsage: 0 });
  const dashFn = useServerFn(getResearchDashboard);
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
      .select("id, instagram_url, post_type, source_account, performance_score, created_at, scraped_data")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load analyses");
      setLoading(false);
      return;
    }

    setAnalyses(data || []);

    const [clonesRes, savedRes] = await Promise.all([
      supabase.from("clones").select("*", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("saved_projects").select("*", { count: "exact", head: true }).eq("user_id", uid),
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = (data ?? []).filter(
      (a) => a.created_at && new Date(a.created_at) >= monthStart,
    ).length;

    setStats({
      posts: data?.length || 0,
      clones: clonesRes.count ?? 0,
      saved: savedRes.count ?? 0,
      monthUsage: thisMonth,
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

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-full">
      {/* Ambient gradient wash behind the header */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 gradient-glow" />

        <div className="relative mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:py-10">
          {/* ── Greeting header ─────────────────────────────── */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {today}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {greeting}
                {firstName ? (
                  <>
                    , <span className="gradient-text">{firstName}</span>
                  </>
                ) : (
                  ""
                )}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Here's what's happening across your content studio.
              </p>
            </div>
            <Button
              onClick={() => navigate({ to: "/app" })}
              size="lg"
              className="gradient-accent gap-2 self-start border-0 text-white shadow-ig hover:opacity-95 sm:self-auto"
            >
              <Sparkles className="h-4 w-4" /> Analyze a Post
            </Button>
          </header>

          {/* ── KPI band ────────────────────────────────────── */}
          <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              icon={<Search className="h-4 w-4" />}
              label="Posts Analyzed"
              value={stats.posts}
              loading={loading}
            />
            <StatTile
              icon={<Copy className="h-4 w-4" />}
              label="Clones Generated"
              value={stats.clones}
              loading={loading}
            />
            <StatTile
              icon={<Bookmark className="h-4 w-4" />}
              label="Saved Projects"
              value={stats.saved}
              loading={loading}
            />
            <StatTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="This Month"
              value={stats.monthUsage}
              loading={loading}
            />
          </section>

          {/* ── Quick actions ───────────────────────────────── */}
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionCard
              icon={<Copy className="h-5 w-5" />}
              title="Clone Studio"
              desc="Break down & clone any post"
              accent
              onClick={() => navigate({ to: "/app" })}
            />
            <ActionCard
              icon={<Microscope className="h-5 w-5" />}
              title="Research"
              desc="Find what audiences want"
              onClick={() => navigate({ to: "/research" })}
            />
            <ActionCard
              icon={<Calendar className="h-5 w-5" />}
              title="Content Calendar"
              desc="Schedule 30 days of content"
              onClick={() => navigate({ to: "/calendar" })}
            />
            <ActionCard
              icon={<Send className="h-5 w-5" />}
              title="Publishing"
              desc="Push to every platform"
              onClick={() => navigate({ to: "/publishing" })}
            />
          </section>

          {/* ── Main two-column area ────────────────────────── */}
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Recent analyses */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight">Recent Analyses</h2>
                {analyses.length > 0 && (
                  <button
                    onClick={() => navigate({ to: "/projects" })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent-primary hover:underline"
                  >
                    View projects <ChevronRight className="h-3.5 w-3.5" />
                  </button>
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
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold">No analyses yet</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Paste an Instagram URL to break down its Content DNA and generate your first
                    clones.
                  </p>
                  <Button
                    onClick={() => navigate({ to: "/app" })}
                    className="mt-5 gradient-accent gap-2 border-0 text-white"
                  >
                    <Sparkles className="h-4 w-4" /> Analyze Now
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {analyses.slice(0, 6).map((a) => {
                    const raw = a.scraped_data?.displayUrl || a.scraped_data?.thumbnailUrl;
                    const t = proxiedImg(raw);
                    return (
                      <div
                        key={a.id}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-ig transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ig-hover"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                          <AnalysisThumb src={t} postType={a.post_type} account={a.source_account} />
                          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                            {a.post_type || "Post"}
                          </span>
                          <div className="absolute right-2 top-2">
                            <div className="rounded-full bg-black/40 p-0.5 backdrop-blur">
                              <ScoreRing score={a.performance_score ?? 0} />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-3.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              @{a.source_account || "unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
                          </div>
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

            {/* Research intelligence rail */}
            <aside className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Research Intelligence</h2>
              </div>
              <ResearchWidget
                icon={<TrendingUp className="h-4 w-4" />}
                title="Trending Opportunities"
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
