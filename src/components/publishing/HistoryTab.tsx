import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listPublishingJobs, deletePublishingJob } from "@/lib/publishing.functions";
import { resolvePublishingError } from "@/lib/upload-post/shared";
import { JobStatusBadge, type JobRow } from "./jobStatus";

const PAGE = 20;
const HISTORY_STATUSES = ["published", "partially_published", "failed", "cancelled"];

export function HistoryTab() {
  const listFn = useServerFn(listPublishingJobs);
  const delFn = useServerFn(deletePublishingJob);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listFn({
        data: { statuses: HISTORY_STATUSES, limit: PAGE, offset },
      })) as { jobs: JobRow[]; total: number };
      setJobs(res.jobs ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    } finally {
      setLoading(false);
    }
  }, [listFn, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this post from history?")) return;
    try {
      await delFn({ data: { jobId: id } });
      setJobs((j) => j.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold tracking-tight">Publishing History</h2>
      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="font-medium">No published posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Posts you publish or schedule will show up here once complete.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-ig">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Title</th>
                <th className="px-4 py-2.5 font-semibold">Platforms</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Links</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="max-w-[200px] px-4 py-3">
                    <span className="block truncate font-medium">{job.title || "Untitled"}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {job.content_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {job.platforms.join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {job.published_at
                      ? new Date(job.published_at).toLocaleDateString()
                      : new Date(job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(job.results ?? [])
                        .filter((r) => r.post_url)
                        .map((r) => (
                          <a
                            key={r.platform}
                            href={r.post_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs text-accent-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> {r.platform}
                          </a>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(job.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-status-error"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset((o) => o + PAGE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
