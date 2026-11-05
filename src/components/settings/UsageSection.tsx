import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, FolderOpen, Search, Send, Sparkles, Coins } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getUsage } from "@/lib/settings.functions";
import { getCreditBalance, getCreditHistory } from "@/lib/credits.functions";

interface CreditEntry {
  id: string;
  delta: number;
  label: string;
  creditKind: string;
  createdAt: string;
  subject: string | null;
}

interface UsageData {
  projects: number;
  analyses: number;
  publishingJobs: number;
  analysesUsed: number;
  analysesLimit: number;
  plan: string;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">{icon}</div>
      <p className="text-3xl font-extrabold font-mono tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

export function UsageSection() {
  const usageFn = useServerFn(getUsage);
  const balanceFn = useServerFn(getCreditBalance);
  const historyFn = useServerFn(getCreditHistory);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [credits, setCredits] = useState<{ balance: number; planBalance: number; purchasedBalance: number } | null>(null);
  const [history, setHistory] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usageFn().then((res) => setUsage(res as UsageData)).catch(() => {}),
      balanceFn().then(setCredits).catch(() => {}),
      historyFn().then((r) => setHistory(r.entries as CreditEntry[])).catch(() => {}),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
        <p className="text-2xl mb-2">📊</p>
        <p className="font-medium">Your usage will appear here</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first project to start tracking usage.
        </p>
      </div>
    );
  }

  const pct = Math.min(Math.round((usage.analysesUsed / usage.analysesLimit) * 100), 100);
  const monthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Usage</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your activity in {monthName} {new Date().getFullYear()}.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<FolderOpen className="h-4 w-4" />}
          label="Projects this month"
          value={usage.projects}
        />
        <StatCard
          icon={<Search className="h-4 w-4" />}
          label="Analyses this month"
          value={usage.analyses}
        />
        <StatCard
          icon={<Send className="h-4 w-4" />}
          label="Publishing jobs"
          value={usage.publishingJobs}
        />
      </div>

      {/* Analysis credit usage */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-ig space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Analysis Credits</p>
            <p className="text-xs text-muted-foreground capitalize">
              {usage.plan} plan · {usage.analysesLimit - usage.analysesUsed} remaining
            </p>
          </div>
          <span
            className={`text-lg font-extrabold font-mono ${pct >= 90 ? "text-status-error" : "text-foreground"}`}
          >
            {usage.analysesUsed} / {usage.analysesLimit}
          </span>
        </div>
        <Progress
          value={pct}
          className={`h-3 ${pct >= 90 ? "[&>div]:bg-status-error" : "[&>div]:gradient-accent"}`}
        />
        {pct >= 90 && (
          <p className="text-xs text-status-error">
            You've used {pct}% of your monthly credits. Consider upgrading your plan.
          </p>
        )}
        {usage.analyses === 0 && usage.projects === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No activity this month yet — start analyzing content to see your stats here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
