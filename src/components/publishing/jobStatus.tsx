import { CheckCircle2, XCircle, Loader2, Clock, CalendarClock, Ban } from "lucide-react";
import type { JobStatus } from "@/lib/upload-post/shared";

export interface ResultRow {
  platform: string;
  status: string;
  post_url: string | null;
  error_message: string | null;
}

export interface JobRow {
  id: string;
  title: string | null;
  content_type: string;
  platforms: string[];
  status: JobStatus;
  scheduled_at: string | null;
  created_at: string;
  published_at: string | null;
  last_error_message: string | null;
  results?: ResultRow[];
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    draft: {
      label: "Draft",
      cls: "text-muted-foreground bg-muted",
      icon: <Clock className="h-3 w-3" />,
    },
    queued: {
      label: "Queued",
      cls: "text-amber-600 bg-amber-500/10",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    uploading: {
      label: "Uploading",
      cls: "text-amber-600 bg-amber-500/10",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    processing: {
      label: "Processing",
      cls: "text-amber-600 bg-amber-500/10",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    published: {
      label: "Published",
      cls: "text-status-success bg-status-success/10",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    partially_published: {
      label: "Partial",
      cls: "text-amber-600 bg-amber-500/10",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      label: "Failed",
      cls: "text-status-error bg-status-error/10",
      icon: <XCircle className="h-3 w-3" />,
    },
    scheduled: {
      label: "Scheduled",
      cls: "text-blue-600 bg-blue-500/10",
      icon: <CalendarClock className="h-3 w-3" />,
    },
    cancelled: {
      label: "Cancelled",
      cls: "text-muted-foreground bg-muted",
      icon: <Ban className="h-3 w-3" />,
    },
  };
  const m = map[status] ?? map.queued;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}
    >
      {m.icon} {m.label}
    </span>
  );
}

export function PlatformResultPill({ result }: { result: ResultRow }) {
  const icon =
    result.status === "published" ? (
      <CheckCircle2 className="h-3 w-3 text-status-success" />
    ) : result.status === "failed" ? (
      <XCircle className="h-3 w-3 text-status-error" />
    ) : (
      <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
    );
  const content = (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px]">
      {icon}
      <span className="capitalize">{result.platform}</span>
    </span>
  );
  if (result.post_url) {
    return (
      <a
        href={result.post_url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        {content}
      </a>
    );
  }
  return content;
}
