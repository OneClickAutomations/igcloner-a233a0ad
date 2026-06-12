import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Trash2, ExternalLink } from "lucide-react";

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
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, clones: 0, saved: 0, monthUsage: 0 });

  useEffect(() => {
    loadAnalyses();
  }, []);

  async function loadAnalyses() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

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

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-8">Your analysis history and usage</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Posts Analyzed", value: stats.posts },
            { label: "Clones Generated", value: stats.clones },
            { label: "Saved Projects", value: stats.saved },
            { label: "This Month", value: stats.monthUsage },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-2xl font-bold font-mono text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-3 w-12 rounded bg-muted mb-3" />
                <div className="h-4 w-32 rounded bg-muted mb-2" />
                <div className="h-3 w-20 rounded bg-muted mb-4" />
                <div className="h-8 w-24 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
            <div className="mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold mb-1">No analyses yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Analyze your first post to see your history here
            </p>
            <Button onClick={() => navigate({ to: "/app" })}>Analyze Now</Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analyses.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-border-default hover:-translate-y-0.5"
              >
                {(() => {
                  const t = a.scraped_data?.displayUrl || a.scraped_data?.thumbnailUrl;
                  return t ? (
                    <div className="mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                      <img src={t} alt={`@${a.source_account ?? ""} post`} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-lg gradient-card text-3xl">
                      {a.post_type === "Reel" ? "🎬" : a.post_type === "Carousel" ? "🎴" : "📸"}
                    </div>
                  );
                })()}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 text-xs font-medium text-accent-secondary">
                      {a.post_type || "Post"}
                    </span>
                    <p className="text-sm font-medium truncate mt-2">@{a.source_account || "unknown"}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
                  </div>
                  <ScoreRing score={a.performance_score ?? 0} />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigate({ to: "/app", search: { analysisId: a.id } })}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Analysis
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-status-error hover:text-status-error"
                    onClick={() => deleteAnalysis(a.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
