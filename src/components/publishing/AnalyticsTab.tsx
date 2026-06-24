import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, TrendingUp, Users, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchAnalytics } from "@/lib/analytics.functions";
import {
  resolvePublishingError,
  PLATFORM_META,
  type PublishingPlatform,
} from "@/lib/upload-post/shared";

interface Snapshot {
  platform: string;
  followers_count: number | null;
  impressions: number | null;
  reach: number | null;
  profile_views: number | null;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AnalyticsTab() {
  const fetchFn = useServerFn(fetchAnalytics);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cached, setCached] = useState(false);

  const load = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = (await fetchFn({ data: { forceRefresh } })) as {
        snapshots: Snapshot[];
        cached: boolean;
      };
      setSnapshots(res.snapshots ?? []);
      setCached(res.cached);
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = snapshots.reduce(
    (acc, s) => ({
      impressions: acc.impressions + (s.impressions ?? 0),
      reach: acc.reach + (s.reach ?? 0),
      followers: acc.followers + (s.followers_count ?? 0),
    }),
    { impressions: 0, reach: 0, followers: 0 },
  );

  const maxImpr = Math.max(1, ...snapshots.map((s) => s.impressions ?? 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading analytics…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            {cached ? "Cached today — " : ""}Aggregated across your connected accounts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="font-medium">No analytics yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect accounts and publish content to start collecting performance data.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Total Impressions"
              value={fmt(totals.impressions)}
            />
            <StatCard
              icon={<Eye className="h-4 w-4" />}
              label="Total Reach"
              value={fmt(totals.reach)}
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Followers"
              value={fmt(totals.followers)}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Platform Breakdown
            </h3>
            <div className="space-y-3">
              {snapshots
                .slice()
                .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
                .map((s) => (
                  <div key={s.platform}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        {PLATFORM_META[s.platform as PublishingPlatform]?.emoji}{" "}
                        {PLATFORM_META[s.platform as PublishingPlatform]?.label ?? s.platform}
                      </span>
                      <span className="text-muted-foreground">
                        {fmt(s.impressions)} impressions · {fmt(s.followers_count)} followers
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full gradient-accent"
                        style={{ width: `${((s.impressions ?? 0) / maxImpr) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-ig">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
