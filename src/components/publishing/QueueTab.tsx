import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listPublishingJobs,
  pollPublishingStatus,
  cancelScheduledJob,
} from "@/lib/publishing.functions";
import { IN_FLIGHT_JOB_STATUSES, resolvePublishingError } from "@/lib/upload-post/shared";
import { JobStatusBadge, PlatformResultPill, type JobRow } from "./jobStatus";

const ACTIVE_STATUSES = [...IN_FLIGHT_JOB_STATUSES, "scheduled"];

export function QueueTab() {
  const listFn = useServerFn(listPublishingJobs);
  const pollFn = useServerFn(pollPublishingStatus);
  const cancelFn = useServerFn(cancelScheduledJob);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = (await listFn({ data: { statuses: ACTIVE_STATUSES, limit: 50 } })) as {
        jobs: JobRow[];
      };
      setJobs(res.jobs ?? []);
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll in-flight jobs every 5s. Each tick updates results server-side, then
  // we refresh the list. Polling stops automatically when nothing is in flight.
  useEffect(() => {
    const inFlight = jobs.filter((j) => IN_FLIGHT_JOB_STATUSES.includes(j.status as any));
    if (inFlight.length === 0) {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    if (pollTimer.current) return; // already polling
    pollTimer.current = setInterval(async () => {
      const current = jobs.filter((j) => IN_FLIGHT_JOB_STATUSES.includes(j.status as any));
      await Promise.all(current.map((j) => pollFn({ data: { jobId: j.id } }).catch(() => {})));
      load();
    }, 5000);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const cancel = async (id: string) => {
    if (!confirm("Cancel this scheduled post?")) return;
    try {
      await cancelFn({ data: { jobId: id } });
      toast.success("Cancelled");
      load();
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading queue…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Publishing Queue</h2>
          <p className="text-sm text-muted-foreground">
            Live status of in-progress and scheduled posts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="font-medium">Nothing in the queue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Published and scheduled posts will appear here while in progress.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-border bg-card p-4 shadow-ig">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{job.title || "Untitled post"}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.scheduled_at
                      ? `Scheduled for ${new Date(job.scheduled_at).toLocaleString()}`
                      : `Started ${new Date(job.created_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <JobStatusBadge status={job.status} />
                  {(job.status === "scheduled" || job.status === "draft") && (
                    <button
                      onClick={() => cancel(job.id)}
                      className="rounded-md p-1 text-muted-foreground hover:text-status-error"
                      aria-label="Cancel"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.results && job.results.length > 0
                  ? job.results.map((r) => <PlatformResultPill key={r.platform} result={r} />)
                  : job.platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] capitalize text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
