import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listPublishingJobs, deletePublishingJob } from "@/lib/publishing.functions";
import {
  resolvePublishingError,
  PLATFORM_META,
  type PublishingPlatform,
} from "@/lib/upload-post/shared";
import { type JobRow } from "./jobStatus";

export function DraftsTab({ onEdit }: { onEdit?: (job: JobRow) => void }) {
  const listFn = useServerFn(listPublishingJobs);
  const delFn = useServerFn(deletePublishingJob);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listFn({ data: { statuses: ["draft"], limit: 50 } })) as {
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

  const remove = async (id: string) => {
    if (!confirm("Delete this draft?")) return;
    try {
      await delFn({ data: { jobId: id } });
      setJobs((j) => j.filter((x) => x.id !== id));
      toast.success("Draft deleted");
    } catch (e) {
      toast.error(resolvePublishingError(e).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading drafts…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
        <p className="font-medium">No drafts</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use “Save Draft” in the Publish tab to store a post for later.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold tracking-tight">Drafts</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-2xl border border-border bg-card p-4 shadow-ig">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{job.title || "Untitled draft"}</p>
                <p className="text-xs capitalize text-muted-foreground">{job.content_type}</p>
              </div>
              <button
                onClick={() => remove(job.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-status-error"
                aria-label="Delete draft"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {job.platforms.map((p) => (
                <span key={p} className="text-sm" title={p}>
                  {PLATFORM_META[p as PublishingPlatform]?.emoji ?? p}
                </span>
              ))}
            </div>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => onEdit(job)}
              >
                Open in Publish
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
