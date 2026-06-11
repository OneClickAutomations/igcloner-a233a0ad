import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Trash2, ExternalLink, Loader2 } from "lucide-react";

interface AnalysisItem {
  id: string;
  instagram_url: string;
  post_type: string | null;
  source_account: string | null;
  performance_score: number | null;
  created_at: string | null;
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
    if (!userData.user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("analyses")
      .select("id, instagram_url, post_type, source_account, performance_score, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load analyses");
    } else {
      setAnalyses(data || []);
      setStats({
        posts: data?.length || 0,
        clones: (data?.length || 0) * 5,
        saved: 0,
        monthUsage: data?.length || 0,
      });
    }
    setLoading(false);
  }

  async function deleteAnalysis(id: string) {
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted");
      loadAnalyses();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">IGCloner</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
            Analyze
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
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-8">Your analysis history and usage</p>

        {/* Stats */}
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
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
            <div className="mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold mb-1">No analyses yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Your first analysis is one paste away</p>
            <Button onClick={() => navigate({ to: "/app" })}>Analyze Your First Post</Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analyses.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4 transition-all hover:border-border-default hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 text-xs font-medium text-accent-secondary">
                    {a.post_type || "Post"}
                  </span>
                  <span className="font-mono text-xs font-bold text-accent-primary">{a.performance_score || 0}</span>
                </div>
                <p className="text-sm font-medium truncate mb-1">@{a.source_account || "unknown"}</p>
                <p className="text-xs text-muted-foreground mb-3">{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate({ to: "/app" })}>
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </Button>
                  <Button variant="ghost" size="sm" className="text-status-error hover:text-status-error" onClick={() => deleteAnalysis(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
